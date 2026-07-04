import { useState } from "react";

// ============================================================
// Exact fraction arithmetic (BigInt-based) — unchanged core
// ============================================================

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
  add(f) { return new Fraction(this.num * f.den + f.num * this.den, this.den * f.den); }
  sub(f) { return new Fraction(this.num * f.den - f.num * this.den, this.den * f.den); }
  mul(f) { return new Fraction(this.num * f.num, this.den * f.den); }
  div(f) { return new Fraction(this.num * f.den, this.den * f.num); }
  neg() { return new Fraction(-this.num, this.den); }
  isZero() { return this.num === 0n; }
  isPositive() { return this.num > 0n; }
  cmp(f) {
    const l = this.num * f.den;
    const r = f.num * this.den;
    if (l < r) return -1;
    if (l > r) return 1;
    return 0;
  }
  gt(f) { return this.cmp(f) > 0; }
  lt(f) { return this.cmp(f) < 0; }
  toNumber() { return Number(this.num) / Number(this.den); }
  toString() {
    if (this.den === 1n) return this.num.toString();
    return `${this.num.toString()}/${this.den.toString()}`;
  }
}

const FZERO = new Fraction(0n, 1n);
const FONE = new Fraction(1n, 1n);

// ---------- Symbolic "linear in M" numbers (c + m·M) ----------
// Used only for costs / Cj / Δj / Z, so that M is never replaced by
// a concrete number and stays a literal "M" in the display, exactly
// like the textbook method (5+2M, 3-M, -M, -M-5/2, ...).
class LM {
  constructor(c = FZERO, m = FZERO) {
    this.c = c;
    this.m = m;
  }
  add(o) { return new LM(this.c.add(o.c), this.m.add(o.m)); }
  sub(o) { return new LM(this.c.sub(o.c), this.m.sub(o.m)); }
  neg() { return new LM(this.c.neg(), this.m.neg()); }
  mulF(f) { return new LM(this.c.mul(f), this.m.mul(f)); } // scalar (Fraction) multiply
  isZero() { return this.c.isZero() && this.m.isZero(); }
  // M is treated as "arbitrarily large positive": the M-coefficient
  // dominates the comparison, the constant only breaks ties.
  cmp(o) {
    const mc = this.m.cmp(o.m);
    if (mc !== 0) return mc;
    return this.c.cmp(o.c);
  }
  gt(o) { return this.cmp(o) > 0; }
  lt(o) { return this.cmp(o) < 0; }
}
const LMZERO = new LM(FZERO, FZERO);

function fractionFromString(s) {
  s = (s || "").trim();
  if (s === "" || s === "+") return new Fraction(1n, 1n);
  if (s === "-") return new Fraction(-1n, 1n);
  let sign = 1n;
  if (s[0] === "-") { sign = -1n; s = s.slice(1); }
  else if (s[0] === "+") { s = s.slice(1); }
  if (s.includes(".")) {
    const [intPart, fracPart] = s.split(".");
    const denStr = "1" + "0".repeat(fracPart.length);
    const numStr = (intPart || "0") + fracPart;
    return new Fraction(sign * BigInt(numStr === "" ? "0" : numStr), BigInt(denStr));
  }
  return new Fraction(sign * BigInt(s === "" ? "1" : s), 1n);
}

// ============================================================
// Parsing helpers — unchanged
// ============================================================

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
  if (Object.keys(terms).length === 0) return { error: `Aucune variable trouvée dans : "${line}"` };
  return { terms, op, rhs };
}

function parseObjective(text) {
  const typeMatch = text.match(/MIN|MAX/i);
  const type = typeMatch ? typeMatch[0].toUpperCase() : "MAX";
  let content = text.replace(/^[^(]*\(/, "").replace(/\)\s*$/, "");
  if (content.includes("=")) content = content.slice(content.indexOf("=") + 1);
  const terms = extractTerms(content);
  if (Object.keys(terms).length === 0) return { error: "Impossible de lire la fonction objectif." };
  return { type, terms };
}

function buildProblem(objectifStr, contraintesStr) {
  const objResult = parseObjective(objectifStr);
  if (objResult.error) return { error: objResult.error };

  const lines = contraintesStr.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
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

// ============================================================
// Simplex (Big-M method, exact fractions) — restructured to
// capture every pedagogical sub-step (entering column, ratio
// test, pivot, new pivot row) instead of only before/after
// tableaus.
// ============================================================

function solveSimplex({ nVars, isMax, objCoeffs, constraints }) {
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
  let slackCount = 0, surplusCount = 0, artCount = 0;
  cons.forEach((c) => {
    if (c.op === "<=") slackCount++;
    else if (c.op === ">=") { surplusCount++; artCount++; }
    else artCount++;
  });

  const totalVars = nVars + slackCount + surplusCount + artCount;
  const colTypes = [];
  for (let i = 0; i < nVars; i++) colTypes.push("var");

  const costs = new Array(totalVars).fill(LMZERO);
  for (let i = 0; i < nVars; i++) costs[i] = new LM(cOrig[i], FZERO);

  const tableau = cons.map((c) => {
    const row = new Array(totalVars + 1).fill(FZERO);
    for (let j = 0; j < nVars; j++) row[j] = c.coeffs[j];
    return row;
  });
  const basis = new Array(m).fill(-1);
  const artificialCols = [];
  const rowExtra = Array.from({ length: m }, () => []); // per-row list of {col, type, sign}
  let nextCol = nVars;

  // Pass 1: slack (<=) / surplus (>=) columns, in constraint order.
  cons.forEach((c, i) => {
    if (c.op === "<=") {
      tableau[i][nextCol] = FONE;
      colTypes.push("slack");
      costs[nextCol] = LMZERO;
      basis[i] = nextCol;
      rowExtra[i].push({ col: nextCol, type: "slack", sign: 1 });
      nextCol++;
    } else if (c.op === ">=") {
      tableau[i][nextCol] = FONE.neg();
      colTypes.push("surplus");
      costs[nextCol] = LMZERO;
      rowExtra[i].push({ col: nextCol, type: "surplus", sign: -1 });
      nextCol++;
    }
  });

  // Pass 2: artificial columns, in constraint order, added back onto
  // their row once every slack/surplus column already exists.
  cons.forEach((c, i) => {
    if (c.op === ">=" || c.op === "=") {
      tableau[i][nextCol] = FONE;
      colTypes.push("artificial");
      costs[nextCol] = new LM(FZERO, FONE.neg()); // -M
      basis[i] = nextCol;
      artificialCols.push(nextCol);
      rowExtra[i].push({ col: nextCol, type: "artificial", sign: 1 });
      nextCol++;
    }
  });

  cons.forEach((c, i) => { tableau[i][totalVars] = c.rhs; });

  function computeObjRow() {
    const objRow = new Array(totalVars + 1).fill(LMZERO);
    for (let j = 0; j <= totalVars; j++) {
      let zj = LMZERO;
      for (let i = 0; i < m; i++) zj = zj.add(costs[basis[i]].mulF(tableau[i][j]));
      objRow[j] = j < totalVars ? costs[j].sub(zj) : zj;
    }
    return objRow;
  }

  const iterations = [];
  const decisions = [];
  let unbounded = false;
  let iterCount = 0;
  const maxIter = 200;

  while (true) {
    const objRow = computeObjRow();
    iterations.push({
      tableau: tableau.map((r) => r.slice()),
      basis: basis.slice(),
      objRow: objRow.slice(),
    });

    let enterCol = -1, maxVal = LMZERO;
    for (let j = 0; j < totalVars; j++) {
      if (objRow[j].gt(maxVal)) { maxVal = objRow[j]; enterCol = j; }
    }

    if (enterCol === -1 || iterCount >= maxIter) {
      decisions.push(null);
      break;
    }

    const ratios = new Array(m).fill(null);
    let leaveRow = -1, minRatio = null;
    for (let i = 0; i < m; i++) {
      if (tableau[i][enterCol].isPositive()) {
        const ratio = tableau[i][totalVars].div(tableau[i][enterCol]);
        ratios[i] = ratio;
        if (minRatio === null || ratio.lt(minRatio)) { minRatio = ratio; leaveRow = i; }
      }
    }

    if (leaveRow === -1) {
      decisions.push({ enterCol, ratios, leaveRow: -1, unbounded: true });
      unbounded = true;
      break;
    }

    const pivotVal = tableau[leaveRow][enterCol];
    const newPivotRow = tableau[leaveRow].map((x) => x.div(pivotVal));
    decisions.push({ enterCol, ratios, leaveRow, pivotVal, newPivotRow });

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
    iterCount++;
  }

  let infeasible = false;
  for (let i = 0; i < m; i++) {
    if (artificialCols.includes(basis[i]) && tableau[i][totalVars].isPositive()) infeasible = true;
  }

  const solution = new Array(nVars).fill(FZERO);
  for (let i = 0; i < m; i++) {
    if (basis[i] < nVars) solution[basis[i]] = tableau[i][totalVars];
  }

  const lastObjRow = iterations[iterations.length - 1].objRow;
  let zValue = lastObjRow[totalVars];
  if (!isMax) zValue = zValue.neg();
  const zHasM = !zValue.m.isZero();

  return {
    iterations, decisions, costs, colTypes, rowExtra,
    solution, zValue, zHasM, infeasible, unbounded, nVars, totalVars, m,
  };
}

// ============================================================
// Display helpers
// ============================================================

function fmt(f) {
  if (f instanceof Fraction) return f.toString();
  return String(f);
}

// Formats a symbolic "c + m·M" value the way the textbook does:
// "5", "-M", "5+2M", "3-M", "-2+2M"... M is never resolved to a number.
function fmtLM(v) {
  if (!(v instanceof LM)) return fmt(v);
  const { c, m } = v;
  if (m.isZero()) return fmt(c);
  const mNeg = m.lt(FZERO);
  const mAbs = mNeg ? m.neg() : m;
  const mCoeff = mAbs.den === 1n && mAbs.num === 1n ? "" : fmt(mAbs);
  const mTerm = `${mNeg ? "-" : ""}${mCoeff}M`;
  if (c.isZero()) return mTerm;
  const cNeg = c.lt(FZERO);
  const cAbs = cNeg ? c.neg() : c;
  return `${cNeg ? "-" : ""}${fmt(cAbs)}${mNeg ? "-" : "+"}${mCoeff}M`;
}

function fmtCost(cost) {
  return fmtLM(cost);
}

function varName(idx) {
  // idx is 0-based column index -> x subscript (idx+1)
  return (
    <>
      x<sub>{idx + 1}</sub>
    </>
  );
}

// Renders a linear expression from a coefficient array (0-based, Fraction[])
function Expr({ coeffs, showZeros = false }) {
  const parts = [];
  coeffs.forEach((c, i) => {
    const val = c || FZERO;
    const isZero = val.isZero();
    if (isZero && !showZeros) return;
    const neg = val.lt(FZERO);
    const abs = neg ? val.neg() : val;
    const isOne = abs.den === 1n && abs.num === 1n;
    const sign = parts.length === 0 ? (neg ? "−" : "") : neg ? " − " : " + ";
    parts.push(
      <span key={i}>
        {sign}
        {isOne ? "" : fmt(abs)}x<sub>{i + 1}</sub>
      </span>
    );
  });
  if (parts.length === 0) return <span>0</span>;
  return <>{parts}</>;
}

function opSymbol(op) {
  if (op === "<=") return "\u2264";
  if (op === ">=") return "\u2265";
  return "=";
}

// ============================================================
// Tableau (classic French textbook layout) with optional
// pedagogical overlays: entering-column mark, ratio column,
// pivot mark, and "new pivot row" preview.
// ============================================================

function Tableau({ costs, colTypes, tableau, basis, objRow, totalVars, highlight }) {
  const zValue = objRow[objRow.length - 1];
  const phase = highlight?.phase;
  const enterCol = highlight?.enterCol ?? -1;
  const leaveRow = highlight?.leaveRow ?? -1;
  const ratios = highlight?.ratios;
  const showRatio = phase === "ratio" || phase === "pivot" || phase === "newrow";
  const showPivotMark = phase === "pivot" || phase === "newrow";
  const showNewRow = phase === "newrow";
  const newPivotRow = highlight?.newPivotRow;

  return (
    <table className="border-collapse mx-auto text-sm text-center">
      <thead>
        <tr>
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50">Ci</th>
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50">i</th>
          {Array.from({ length: totalVars }, (_, j) => (
            <th
              key={j}
              className={`border border-slate-400 px-3 py-1.5 font-serif italic ${
                j === enterCol ? "bg-blue-100 text-blue-800" : "bg-slate-50"
              }`}
            >
              A<sub>{j + 1}</sub>
            </th>
          ))}
          <th className="border border-slate-400 px-3 py-1.5 bg-slate-50 font-serif italic">
            A<sub>0</sub>
          </th>
          {showRatio && (
            <th className="border border-slate-400 px-3 py-1.5 bg-amber-50 font-serif italic whitespace-nowrap">
              x<sub>i</sub> / x<sub>i2</sub>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {tableau.map((row, i) => {
          const isPivotRow = showPivotMark && i === leaveRow;
          return (
            <tr key={i}>
              <td className="border border-slate-400 px-3 py-1.5">
                {fmtCost(costs[basis[i]], colTypes[basis[i]])}
              </td>
              <td className="border border-slate-400 px-3 py-1.5">{basis[i] + 1}</td>
              {row.slice(0, -1).map((val, j) => {
                const isPivotCell = showPivotMark && i === leaveRow && j === enterCol;
                const displayVal =
                  showNewRow && i === leaveRow && newPivotRow ? newPivotRow[j] : val;
                return (
                  <td
                    key={j}
                    className={`border border-slate-400 px-3 py-1.5 font-mono ${
                      isPivotCell
                        ? "bg-blue-600 text-white font-bold"
                        : showNewRow && i === leaveRow
                        ? "bg-green-50 text-green-800 font-semibold"
                        : j === enterCol
                        ? "bg-blue-50"
                        : isPivotRow
                        ? "bg-slate-50"
                        : ""
                    }`}
                  >
                    {fmt(displayVal)}
                  </td>
                );
              })}
              <td
                className={`border border-slate-400 px-3 py-1.5 font-mono font-semibold ${
                  showNewRow && i === leaveRow ? "bg-green-50 text-green-800" : ""
                }`}
              >
                {fmt(showNewRow && i === leaveRow && newPivotRow ? newPivotRow[totalVars] : row[row.length - 1])}
              </td>
              {showRatio && (
                <td
                  className={`border border-slate-400 px-3 py-1.5 font-mono ${
                    i === leaveRow ? "bg-red-100 text-red-700 font-bold" : ""
                  }`}
                >
                  {ratios && ratios[i] ? fmt(ratios[i]) : "\u221e"}
                </td>
              )}
            </tr>
          );
        })}

        <tr>
          <td colSpan={2} className="border border-slate-400 px-3 py-1.5 font-semibold text-right">
            Cj
          </td>
          {costs.map((c, j) => (
            <td
              key={j}
              className={`border border-slate-400 px-3 py-1.5 font-mono ${
                j === enterCol ? "bg-blue-50" : ""
              }`}
            >
              {fmtCost(c, colTypes[j])}
            </td>
          ))}
          <td className="border border-slate-400 px-3 py-1.5"></td>
          {showRatio && <td className="border border-slate-400 px-3 py-1.5"></td>}
        </tr>

        <tr>
          <td colSpan={2} className="border border-slate-400 px-3 py-1.5 font-semibold text-right">
            Δj
          </td>
          {objRow.slice(0, -1).map((val, j) => (
            <td
              key={j}
              className={`border border-slate-400 px-3 py-1.5 font-mono ${
                j === enterCol ? "bg-red-100 text-red-700 font-bold" : ""
              }`}
            >
              {fmtLM(val)}
            </td>
          ))}
          <td className="border-2 border-slate-700 px-3 py-1.5 font-mono font-semibold">
            Z = {fmtLM(zValue)}
          </td>
          {showRatio && <td className="border border-slate-400 px-3 py-1.5"></td>}
        </tr>
      </tbody>
    </table>
  );
}

// ============================================================
// Equalize view — canonical (≤/≥/=) system next to its
// equality form with slack / surplus / artificial variables.
// ============================================================

function EqualizeView({ problem, result }) {
  const { nVars, isMax, objCoeffs, constraints } = problem;
  const { totalVars, iterations, costs, colTypes } = result;
  const initTableau = iterations[0].tableau;

  const objExtended = new Array(totalVars).fill(FZERO);
  for (let i = 0; i < nVars; i++) objExtended[i] = objCoeffs[i];

  const hasNonSlack = colTypes.slice(nVars).some((t) => t !== "slack");

  return (
    <div className="bg-white rounded-xl shadow border p-6">
      <h3 className="font-semibold text-slate-800 mb-4">
        Mise sous forme canonique (égalisation des contraintes)
      </h3>
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div className="space-y-2 font-mono text-base">
          {constraints.map((c, i) => (
            <div key={i}>
              <Expr coeffs={c.coeffs} /> {opSymbol(c.op)} {fmt(c.rhs)}
            </div>
          ))}
          <div className="pt-2 text-indigo-700">
            {isMax ? "MAX" : "MIN"}(Z = <Expr coeffs={objCoeffs} />)
          </div>
        </div>
        <div className="space-y-2 font-mono text-base border-l-0 md:border-l md:pl-6 border-slate-200">
          {initTableau.map((row, i) => (
            <div key={i}>
              <Expr coeffs={row.slice(0, totalVars)} /> = {fmt(row[totalVars])}
            </div>
          ))}
          <div className="pt-2 text-indigo-700">
            {isMax ? "MAX" : "MIN"}(Z = <Expr coeffs={objExtended} showZeros={false} />
            {colTypes.slice(nVars).map((t, k) => (
              <span key={k}> + {fmtCost(costs[nVars + k], t)}x<sub>{nVars + k + 1}</sub></span>
            ))}
            )
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="bg-slate-50 border rounded-lg px-4 py-2">
          <span className="font-semibold text-slate-700">Variables principales : </span>
          x<sub>1</sub>…x<sub>{nVars}</sub>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          <span className="font-semibold text-red-700">
            Variables d'écart{hasNonSlack ? " / auxiliaires" : ""} :{" "}
          </span>
          x<sub>{nVars + 1}</sub>…x<sub>{totalVars}</sub>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Matrix view — A·x = b with the initial basis highlighted,
// plus the resulting initial solution (x_basic = rhs).
// ============================================================

function MatrixView({ problem, result }) {
  const { totalVars, iterations, m, nVars, costs, basis: _b } = result;
  const init = iterations[0];
  const basis = init.basis;
  const tableau = init.tableau;

  let z0 = LMZERO;
  for (let i = 0; i < m; i++) z0 = z0.add(costs[basis[i]].mulF(tableau[i][totalVars]));
  if (!problem.isMax) z0 = z0.neg();

  return (
    <div className="bg-white rounded-xl shadow border p-6">
      <h3 className="font-semibold text-slate-800 mb-4">Forme matricielle — Initialisation</h3>
      <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-serif">[</span>
          <table className="border-collapse">
            <tbody>
              {tableau.map((row, i) => (
                <tr key={i}>
                  {row.slice(0, totalVars).map((val, j) => (
                    <td
                      key={j}
                      className={`px-3 py-1 font-mono text-center ${
                        basis.includes(j) ? "bg-green-50" : ""
                      }`}
                    >
                      {fmt(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-3xl font-serif">]</span>
          <table className="border-collapse">
            <tbody>
              {Array.from({ length: totalVars }, (_, j) => (
                <tr key={j}>
                  <td className="px-2 py-1 font-mono text-center">
                    x<sub>{j + 1}</sub>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-xl">=</span>
          <span className="text-3xl font-serif">[</span>
          <table className="border-collapse">
            <tbody>
              {tableau.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-1 font-mono text-center font-semibold">
                    {fmt(row[totalVars])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-3xl font-serif">]</span>
        </div>
      </div>
      <div className="flex justify-center mt-1">
        <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
          colonnes en vert = base initiale
        </span>
      </div>

      <div className="mt-6 bg-slate-50 border rounded-lg p-5 text-sm leading-7">
        <div className="font-semibold text-slate-700 mb-1">Initialisation — solution initiale</div>
        <div>
          Z = {fmtLM(z0)} &nbsp;⇒&nbsp;{" "}
          {Array.from({ length: nVars }, (_, i) => (
            <span key={i} className="font-mono">
              x<sub>{i + 1}</sub>
              {i < nVars - 1 ? " = " : " = 0"}
            </span>
          ))}
        </div>
        <div className="mt-2">
          {tableau.map((row, i) => (
            <div key={i} className="font-mono">
              x<sub>{basis[i] + 1}</sub> = {fmt(row[totalVars])}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Final solution view
// ============================================================

function FinalView({ result }) {
  return (
    <div className="bg-white rounded-xl shadow border p-6">
      <h3 className="font-semibold text-slate-800 mb-4">Solution optimale</h3>
      <div className="flex flex-wrap gap-3">
        {result.solution.map((v, i) => (
          <div key={i} className="bg-indigo-50 text-indigo-800 rounded-lg px-4 py-2 font-mono text-sm">
            x{i + 1} = {fmt(v)}
          </div>
        ))}
        <div className="bg-green-50 text-green-800 rounded-lg px-4 py-2 font-mono text-sm font-semibold">
          Z = {fmtLM(result.zValue)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Frame construction: one entry per click of "Suivant"
// ============================================================

function buildFrames(result) {
  const frames = [{ type: "equalize" }, { type: "matrix" }];
  result.iterations.forEach((_, k) => {
    const decision = result.decisions[k];
    frames.push({ type: "tableau", k, phase: "base" });
    if (decision && decision.unbounded) {
      frames.push({ type: "tableau", k, phase: "unbounded" });
    } else if (decision) {
      frames.push({ type: "tableau", k, phase: "ratio" });
      frames.push({ type: "tableau", k, phase: "pivot" });
      frames.push({ type: "tableau", k, phase: "newrow" });
    }
  });
  frames.push({ type: "final" });
  return frames;
}

const PHASE_LABEL = {
  base: "Repérage de la colonne entrante (plus grand Δj positif)",
  ratio: "Test du rapport xi / xi2 (colonne entrante)",
  pivot: "Choix du pivot",
  newrow: "Calcul de la nouvelle ligne pivot",
  unbounded: "Problème non borné",
};

// ============================================================
// Main App
// ============================================================

export default function App() {
  const [contraintes, setContraintes] = useState(
    `x1 <= 1000\nx2 <= 500\nx3 <= 1500\n3x1 + 6x2 + 2x3 <= 6750`
  );
  const [objectif, setObjectif] = useState("MAX(Z = 4x1 + 12x2 + 3x3)");
  const [problem, setProblem] = useState(null);
  const [result, setResult] = useState(null);
  const [frames, setFrames] = useState([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [error, setError] = useState("");

  function handleSolve() {
    setError("");
    const prob = buildProblem(objectif, contraintes);
    if (prob.error) {
      setError(prob.error);
      setResult(null);
      return;
    }
    const res = solveSimplex(prob);
    const fr = buildFrames(res);
    setProblem(prob);
    setResult(res);
    setFrames(fr);
    setFrameIdx(0);
  }

  const frame = frames[frameIdx];

  function renderFrame() {
    if (!frame) return null;
    if (frame.type === "equalize") return <EqualizeView problem={problem} result={result} />;
    if (frame.type === "matrix") return <MatrixView problem={problem} result={result} />;
    if (frame.type === "final") {
      return (
        <>
          {result.infeasible && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">
              Le problème est <strong>infaisable</strong> (une variable artificielle reste positive à l'optimum).
            </div>
          )}
          {result.unbounded && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">
              Le problème est <strong>non borné</strong>.
            </div>
          )}
          {!result.infeasible && !result.unbounded && <FinalView result={result} />}
        </>
      );
    }
    if (frame.type === "tableau") {
      const snap = result.iterations[frame.k];
      const decision = result.decisions[frame.k];
      const highlight =
        frame.phase === "base"
          ? { phase: "base", enterCol: decision ? decision.enterCol : -1 }
          : { phase: frame.phase, ...decision };
      return (
        <div className="bg-white rounded-xl shadow border overflow-x-auto p-4">
          <div className="text-sm font-semibold text-slate-600 mb-3">
            Itération {frame.k}
            {!decision && " — Tableau optimal"}
          </div>
          <Tableau
            costs={result.costs}
            colTypes={result.colTypes}
            totalVars={result.totalVars}
            tableau={snap.tableau}
            basis={snap.basis}
            objRow={snap.objRow}
            highlight={highlight}
          />
          {frame.phase === "pivot" && decision && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm font-mono">
              Pivot = a<sub>{decision.leaveRow + 1},{decision.enterCol + 1}</sub> ={" "}
              {fmt(decision.pivotVal)} &nbsp;(ligne {decision.leaveRow + 1}, colonne A
              <sub>{decision.enterCol + 1}</sub>)
              <div className="mt-2 text-slate-700">
                Nouvelle ligne pivot : L<sub>{decision.leaveRow + 1}</sub>' = L
                <sub>{decision.leaveRow + 1}</sub> / {fmt(decision.pivotVal)}
              </div>
            </div>
          )}
          {frame.phase === "newrow" && decision && (
            <div className="mt-4 bg-green-50 border border-green-100 rounded-lg px-4 py-2 text-sm text-green-800">
              Nouvelle ligne pivot L<sub>{decision.leaveRow + 1}</sub>' (en vert dans le tableau).
            </div>
          )}
          {frame.phase === "unbounded" && decision && (
            <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-lg p-4 text-sm">
              Aucun coefficient positif dans la colonne A<sub>{decision.enterCol + 1}</sub> : x
              <sub>{decision.enterCol + 1}</sub> peut croître indéfiniment — le problème est non borné.
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-slate-800">Programmation linéaire — Simplexe</h1>
        <p className="text-slate-500 mt-1">Méthode du grand M, arithmétique exacte (fractions), pas à pas</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] outline-none transition-all resize-none"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] outline-none transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={handleSolve}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            >
              Résoudre avec le simplexe
            </button>
          </div>
        </div>

        {/* ---- Résultats pas à pas ---- */}
        <div className="lg:w-2/3 w-full flex flex-col gap-4">
          {!result && !error && (
            <div className="bg-white rounded-xl shadow border p-10 text-center text-slate-400">
              Renseignez le problème puis cliquez sur « Résoudre avec le simplexe ».
            </div>
          )}

          {result && (
            <>
              <div className="bg-white rounded-xl shadow border p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFrameIdx((i) => Math.max(0, i - 1))}
                    disabled={frameIdx === 0}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
                  >
                    ← Précédent
                  </button>
                  <span className="text-sm text-slate-600 font-medium px-2">
                    Étape {frameIdx + 1} / {frames.length}
                  </span>
                  <button
                    onClick={() => setFrameIdx((i) => Math.min(frames.length - 1, i + 1))}
                    disabled={frameIdx === frames.length - 1}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
                  >
                    Suivant →
                  </button>
                </div>
                <span className="text-sm font-medium text-slate-500">
                  {frame?.type === "equalize" && "Égalisation des contraintes"}
                  {frame?.type === "matrix" && "Forme matricielle"}
                  {frame?.type === "tableau" && PHASE_LABEL[frame.phase]}
                  {frame?.type === "final" && "Résultat final"}
                </span>
              </div>

              {renderFrame()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}