import { useState } from "react";

// ---------- Exact fraction arithmetic (BigInt-based) ----------

function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a === 0n ? 1n : a;
}

class Fraction {
  constructor(num, den = 1n) {
    if (typeof num === "number") num = BigInt(Math.round(num));
    if (typeof den === "number") den = BigInt(Math.round(den));
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    if (num === 0n) den = 1n;
    const g = bgcd(num, den);
    this.num = num / g;
    this.den = den / g;
  }
  add(f) {
    return new Fraction(this.num * f.den + f.num * this.den, this.den * f.den);
  }
  sub(f) {
    return new Fraction(this.num * f.den - f.num * this.den, this.den * f.den);
  }
  mul(f) {
    return new Fraction(this.num * f.num, this.den * f.den);
  }
  div(f) {
    return new Fraction(this.num * f.den, this.den * f.num);
  }
  neg() {
    return new Fraction(-this.num, this.den);
  }
  isZero() {
    return this.num === 0n;
  }
  isPositive() {
    return this.num > 0n;
  }
  cmp(f) {
    const l = this.num * f.den;
    const r = f.num * this.den;
    if (l < r) return -1;
    if (l > r) return 1;
    return 0;
  }
  gt(f) {
    return this.cmp(f) > 0;
  }
  lt(f) {
    return this.cmp(f) < 0;
  }
  toNumber() {
    return Number(this.num) / Number(this.den);
  }
  toString() {
    if (this.den === 1n) return this.num.toString();
    return `${this.num.toString()}/${this.den.toString()}`;
  }
}

const FZERO = new Fraction(0n, 1n);
const FONE = new Fraction(1n, 1n);

function fractionFromString(s) {
  s = (s || "").trim();
  if (s === "" || s === "+") return new Fraction(1n, 1n);
  if (s === "-") return new Fraction(-1n, 1n);
  let sign = 1n;
  if (s[0] === "-") {
    sign = -1n;
    s = s.slice(1);
  } else if (s[0] === "+") {
    s = s.slice(1);
  }
  if (s.includes(".")) {
    const [intPart, fracPart] = s.split(".");
    const denStr = "1" + "0".repeat(fracPart.length);
    const numStr = (intPart || "0") + fracPart;
    return new Fraction(sign * BigInt(numStr === "" ? "0" : numStr), BigInt(denStr));
  }
  return new Fraction(sign * BigInt(s === "" ? "1" : s), 1n);
}

// ---------- Parsing helpers ----------

function extractTerms(expr) {
  const regex = /([+-]\s*\d*\.?\d*|\d*\.?\d*)\s*\*?\s*x\s*(\d+)/gi;
  const terms = {};
  let match;
  while ((match = regex.exec(expr)) !== null) {
    const coeffStr = match[1].replace(/\s+/g, "");
    const idx = parseInt(match[2], 10);
    const coeff = fractionFromString(coeffStr);
    terms[idx] = terms[idx] ? terms[idx].add(coeff) : coeff;
  }
  return terms;
}

function parseConstraintLine(line) {
  const opMatch = line.match(/(<=|>=|=)/);
  if (!opMatch) return { error: `Opérateur (<=, >=, =) introuvable dans : "${line}"` };
  const op = opMatch[1];
  const idx = line.indexOf(op);
  const lhs = line.slice(0, idx);
  const rhsStr = line.slice(idx + op.length).trim();
  if (!/^[+-]?\d*\.?\d+$/.test(rhsStr)) {
    return { error: `Membre droit invalide dans : "${line}"` };
  }
  const rhs = fractionFromString(rhsStr);
  const terms = extractTerms(lhs);
  if (Object.keys(terms).length === 0)
    return { error: `Aucune variable trouvée dans : "${line}"` };
  return { terms, op, rhs };
}

function parseObjective(text) {
  const typeMatch = text.match(/MIN|MAX/i);
  const type = typeMatch ? typeMatch[0].toUpperCase() : "MAX";
  let content = text.replace(/^[^(]*\(/, "").replace(/\)\s*$/, "");
  if (content.includes("=")) {
    content = content.slice(content.indexOf("=") + 1);
  }
  const terms = extractTerms(content);
  if (Object.keys(terms).length === 0) {
    return { error: "Impossible de lire la fonction objectif." };
  }
  return { type, terms };
}

function buildProblem(objectifStr, contraintesStr) {
  const objResult = parseObjective(objectifStr);
  if (objResult.error) return { error: objResult.error };

  const lines = contraintesStr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { error: "Ajoutez au moins une contrainte." };

  const parsedConstraints = [];
  for (const line of lines) {
    const res = parseConstraintLine(line);
    if (res.error) return { error: res.error };
    parsedConstraints.push(res);
  }

  let nVars = 0;
  Object.keys(objResult.terms).forEach((k) => (nVars = Math.max(nVars, parseInt(k, 10))));
  parsedConstraints.forEach((c) =>
    Object.keys(c.terms).forEach((k) => (nVars = Math.max(nVars, parseInt(k, 10))))
  );

  const objCoeffs = new Array(nVars).fill(FZERO);
  Object.entries(objResult.terms).forEach(([k, v]) => (objCoeffs[parseInt(k, 10) - 1] = v));

  const constraints = parsedConstraints.map((c) => {
    const coeffs = new Array(nVars).fill(FZERO);
    Object.entries(c.terms).forEach(([k, v]) => (coeffs[parseInt(k, 10) - 1] = v));
    return { coeffs, op: c.op, rhs: c.rhs };
  });

  return { nVars, isMax: objResult.type === "MAX", objCoeffs, constraints };
}

// ---------- Simplex (Big-M method, exact fractions) ----------

function solveSimplex({ nVars, isMax, objCoeffs, constraints }) {
  const maxAbsNum = Math.max(
    1,
    ...objCoeffs.map((c) => Math.abs(c.toNumber())),
    ...constraints.map((c) => Math.abs(c.rhs.toNumber())),
    ...constraints.flatMap((c) => c.coeffs.map((x) => Math.abs(x.toNumber())))
  );
  const M = new Fraction(BigInt(Math.round(1000 * maxAbsNum) + 1000000), 1n);

  const cOrig = isMax ? objCoeffs.slice() : objCoeffs.map((c) => c.neg());

  const cons = constraints.map((c) => {
    let coeffs = c.coeffs.slice();
    let op = c.op;
    let rhs = c.rhs;
    if (rhs.num < 0n) {
      coeffs = coeffs.map((x) => x.neg());
      rhs = rhs.neg();
      if (op === "<=") op = ">=";
      else if (op === ">=") op = "<=";
    }
    return { coeffs, op, rhs };
  });

  const m = cons.length;
  let slackCount = 0,
    surplusCount = 0,
    artCount = 0;
  cons.forEach((c) => {
    if (c.op === "<=") slackCount++;
    else if (c.op === ">=") {
      surplusCount++;
      artCount++;
    } else artCount++;
  });

  const totalVars = nVars + slackCount + surplusCount + artCount;
  const colNames = [];
  const colTypes = [];
  for (let i = 1; i <= nVars; i++) {
    colNames.push(`x${i}`);
    colTypes.push("var");
  }

  const costs = new Array(totalVars).fill(FZERO);
  for (let i = 0; i < nVars; i++) costs[i] = cOrig[i];

  const tableau = [];
  const basis = new Array(m).fill(-1);
  const artificialCols = [];
  let nextCol = nVars,
    slackIdx = 0,
    surplusIdx = 0,
    artIdx = 0;

  cons.forEach((c, i) => {
    const row = new Array(totalVars + 1).fill(FZERO);
    for (let j = 0; j < nVars; j++) row[j] = c.coeffs[j];
    if (c.op === "<=") {
      row[nextCol] = FONE;
      colNames.push(`s${++slackIdx}`);
      colTypes.push("slack");
      costs[nextCol] = FZERO;
      basis[i] = nextCol;
      nextCol++;
    } else if (c.op === ">=") {
      row[nextCol] = FONE.neg();
      colNames.push(`e${++surplusIdx}`);
      colTypes.push("surplus");
      costs[nextCol] = FZERO;
      nextCol++;
      row[nextCol] = FONE;
      colNames.push(`a${++artIdx}`);
      colTypes.push("artificial");
      costs[nextCol] = M.neg();
      basis[i] = nextCol;
      artificialCols.push(nextCol);
      nextCol++;
    } else {
      row[nextCol] = FONE;
      colNames.push(`a${++artIdx}`);
      colTypes.push("artificial");
      costs[nextCol] = M.neg();
      basis[i] = nextCol;
      artificialCols.push(nextCol);
      nextCol++;
    }
    row[totalVars] = c.rhs;
    tableau.push(row);
  });

  function computeObjRow() {
    const objRow = new Array(totalVars + 1).fill(FZERO);
    for (let j = 0; j <= totalVars; j++) {
      let zj = FZERO;
      for (let i = 0; i < m; i++) zj = zj.add(costs[basis[i]].mul(tableau[i][j]));
      objRow[j] = j < totalVars ? costs[j].sub(zj) : zj;
    }
    return objRow;
  }

  const iterations = [];
  let unbounded = false;
  let iter = 0;
  const maxIter = 200;

  while (iter < maxIter) {
    const objRow = computeObjRow();
    iterations.push({
      tableau: tableau.map((r) => r.slice()),
      basis: basis.slice(),
      objRow: objRow.slice(),
    });

    let enterCol = -1,
      maxVal = FZERO;
    for (let j = 0; j < totalVars; j++) {
      if (objRow[j].gt(maxVal)) {
        maxVal = objRow[j];
        enterCol = j;
      }
    }
    if (enterCol === -1) break;

    let leaveRow = -1,
      minRatio = null;
    for (let i = 0; i < m; i++) {
      if (tableau[i][enterCol].isPositive()) {
        const ratio = tableau[i][totalVars].div(tableau[i][enterCol]);
        if (minRatio === null || ratio.lt(minRatio)) {
          minRatio = ratio;
          leaveRow = i;
        }
      }
    }
    if (leaveRow === -1) {
      unbounded = true;
      break;
    }

    const pivotVal = tableau[leaveRow][enterCol];
    for (let j = 0; j <= totalVars; j++) tableau[leaveRow][j] = tableau[leaveRow][j].div(pivotVal);
    for (let i = 0; i < m; i++) {
      if (i === leaveRow) continue;
      const factor = tableau[i][enterCol];
      if (!factor.isZero()) {
        for (let j = 0; j <= totalVars; j++)
          tableau[i][j] = tableau[i][j].sub(factor.mul(tableau[leaveRow][j]));
      }
    }
    basis[leaveRow] = enterCol;
    iter++;
  }

  const finalObjRow = computeObjRow();
  iterations.push({
    tableau: tableau.map((r) => r.slice()),
    basis: basis.slice(),
    objRow: finalObjRow.slice(),
  });

  let infeasible = false;
  for (let i = 0; i < m; i++) {
    if (artificialCols.includes(basis[i]) && tableau[i][totalVars].isPositive()) infeasible = true;
  }

  const solution = new Array(nVars).fill(FZERO);
  for (let i = 0; i < m; i++) {
    if (basis[i] < nVars) solution[basis[i]] = tableau[i][totalVars];
  }

  let zValue = finalObjRow[totalVars];
  if (!isMax) zValue = zValue.neg();

  return { iterations, colNames, colTypes, costs, solution, zValue, infeasible, unbounded, nVars, totalVars };
}

// ---------- Display helpers ----------

function fmt(f) {
  if (f instanceof Fraction) return f.toString();
  return String(f);
}

function fmtCost(cost, type) {
  if (type === "artificial") return "-M";
  return fmt(cost);
}

// Reproduces the classic French textbook simplex tableau layout:
// Ci | i | A1 A2 ... An | A0   (one row per basic variable)
// then a Cj row and a Δj row, with Z boxed at the far right.
function Tableau({ costs, colTypes, tableau, basis, objRow, totalVars }) {
  const zValue = objRow[objRow.length - 1];
  return (
    <table className="border-collapse mx-auto text-sm text-center">
      <thead>
        <tr>
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50">Ci</th>
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50">i</th>
          {Array.from({ length: totalVars }, (_, j) => (
            <th key={j} className="border border-slate-400 px-3 py-1.5 bg-slate-50 font-serif italic">
              A<sub>{j + 1}</sub>
            </th>
          ))}
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50 font-serif italic">
            A<sub>0</sub>
          </th>
        </tr>
      </thead>
      <tbody>
        {tableau.map((row, i) => (
          <tr key={i}>
            <td className="border border-slate-400 px-3 py-1.5">{fmtCost(costs[basis[i]], colTypes[basis[i]])}</td>
            <td className="border border-slate-400 px-3 py-1.5">{basis[i] + 1}</td>
            {row.slice(0, -1).map((val, j) => (
              <td key={j} className="border border-slate-400 px-3 py-1.5 font-mono">
                {fmt(val)}
              </td>
            ))}
            <td className="border border-slate-400 px-3 py-1.5 font-mono font-semibold">
              {fmt(row[row.length - 1])}
            </td>
          </tr>
        ))}

        <tr>
          <td colSpan={2} className="border border-slate-400 px-3 py-1.5 font-semibold text-right">
            Cj
          </td>
          {costs.map((c, j) => (
            <td key={j} className="border border-slate-400 px-3 py-1.5 font-mono">
              {fmtCost(c, colTypes[j])}
            </td>
          ))}
          <td className="border border-slate-400 px-3 py-1.5"></td>
        </tr>

        <tr>
          <td colSpan={2} className="border border-slate-400 px-3 py-1.5 font-semibold text-right">
            Δj
          </td>
          {objRow.slice(0, -1).map((val, j) => (
            <td key={j} className="border border-slate-400 px-3 py-1.5 font-mono">
              {fmt(val)}
            </td>
          ))}
          <td className="border-2 border-slate-700 px-3 py-1.5 font-mono font-semibold">Z = {fmt(zValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ---------- Main App ----------

export default function App() {
  const [contraintes, setContraintes] = useState(
    `x1 <= 1000\nx2 <= 500\nx3 <= 1500\n3x1 + 6x2 + 2x3 <= 6750`
  );
  const [objectif, setObjectif] = useState("MAX(Z = 4x1 + 12x2 + 3x3)");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [iterIdx, setIterIdx] = useState(0);

  function handleSolve() {
    setError("");
    const problem = buildProblem(objectif, contraintes);
    if (problem.error) {
      setError(problem.error);
      setResult(null);
      return;
    }
    const res = solveSimplex(problem);
    setResult(res);
    setIterIdx(res.iterations.length - 1);
  }

  const currentIter = result ? result.iterations[iterIdx] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-slate-800">Programmation linéaire — Simplexe</h1>
        <p className="text-slate-500 mt-1">Méthode du grand M, arithmétique exacte (fractions)</p>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4">
        {/* ---- Formulaire ---- */}
        <div className="lg:w-1/3 w-full bg-white rounded-xl shadow p-6 border h-fit">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Contraintes</label>
              <textarea
                rows={8}
                value={contraintes}
                onChange={(e) => setContraintes(e.target.value)}
                placeholder={`x1 <= 1000\nx2 <= 500\n3x1 + 6x2 + 2x3 <= 6750\nx1 + x2 >= 100`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm
                focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]
                outline-none transition-all resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Une contrainte par ligne. Opérateurs acceptés : {"<="}, {">="}, {"="}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Fonction objectif</label>
              <input
                type="text"
                value={objectif}
                onChange={(e) => setObjectif(e.target.value)}
                placeholder="MAX(Z = 4x1 + 12x2 + 3x3)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm
                focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]
                outline-none transition-all"
              />
            </div>

            <div className="bg-gray-50 border rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Aperçu</h3>
              <pre className="whitespace-pre-wrap font-mono text-gray-700 text-sm leading-6">
{contraintes}

{objectif}
              </pre>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={handleSolve}
              className="w-full flex items-center justify-center gap-2
              bg-indigo-600 hover:bg-indigo-700
              text-white font-semibold px-4 py-3 rounded-lg
              shadow-md hover:shadow-lg transition-all duration-200"
            >
              Résoudre avec le simplexe
            </button>
          </div>
        </div>

        {/* ---- Résultats ---- */}
        <div className="lg:w-2/3 w-full flex flex-col gap-4">
          {!result && !error && (
            <div className="bg-white rounded-xl shadow border p-10 text-center text-slate-400">
              Renseignez le problème puis cliquez sur « Résoudre avec le simplexe ».
            </div>
          )}

          {result && (
            <>
              {result.infeasible && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                  Le problème est <strong>infaisable</strong> (une variable artificielle reste positive à l'optimum).
                </div>
              )}
              {result.unbounded && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                  Le problème est <strong>non borné</strong>.
                </div>
              )}

              <div className="bg-white rounded-xl shadow border p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIterIdx((i) => Math.max(0, i - 1))}
                    disabled={iterIdx === 0}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
                  >
                    ← Précédent
                  </button>
                  <span className="text-sm text-slate-600 font-medium px-2">
                    Itération {iterIdx} / {result.iterations.length - 1}
                  </span>
                  <button
                    onClick={() => setIterIdx((i) => Math.min(result.iterations.length - 1, i + 1))}
                    disabled={iterIdx === result.iterations.length - 1}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
                  >
                    Suivant →
                  </button>
                </div>
                {iterIdx === result.iterations.length - 1 && !result.infeasible && !result.unbounded && (
                  <span className="text-sm font-semibold text-green-600">Tableau optimal</span>
                )}
              </div>

              <div className="bg-white rounded-xl shadow border overflow-x-auto p-2">
                {currentIter && (
                  <Tableau
                    costs={result.costs}
                    colTypes={result.colTypes}
                    totalVars={result.totalVars}
                    tableau={currentIter.tableau}
                    basis={currentIter.basis}
                    objRow={currentIter.objRow}
                  />
                )}
              </div>

              {!result.infeasible && !result.unbounded && (
                <div className="bg-white rounded-xl shadow border p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Solution optimale</h3>
                  <div className="flex flex-wrap gap-3">
                    {result.solution.map((v, i) => (
                      <div
                        key={i}
                        className="bg-indigo-50 text-indigo-800 rounded-lg px-4 py-2 font-mono text-sm"
                      >
                        x{i + 1} = {fmt(v)}
                      </div>
                    ))}
                    <div className="bg-green-50 text-green-800 rounded-lg px-4 py-2 font-mono text-sm font-semibold">
                      Z = {fmt(result.zValue)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
