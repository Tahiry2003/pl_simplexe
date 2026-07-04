function App() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">

      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-slate-800">
          Programmation lineaire Simplexe
        </h1>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-2">
        <div className="lg:w-1/4 w-full bg-white rounded-xl shadow p-6 border h-fit">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Reapprovisionnement tous les
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                focus:border-blue-500 
                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] 
                outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Reapprovisionnement tous les
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                focus:border-blue-500 
                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] 
                outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Reapprovisionnement tous les
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                focus:border-blue-500 
                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] 
                outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Reapprovisionnement tous les
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                focus:border-blue-500 
                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] 
                outline-none transition-all"
              />
            </div>

            <div>
              <button
                className="w-full flex items-center justify-center gap-2 
                bg-green-500 hover:bg-green-600 
                text-white font-semibold 
                px-4 py-3 rounded-lg 
                shadow-md hover:shadow-lg 
                transition-all duration-200"
              >
                Télécharger Excel
              </button>
            </div>

          </div>
        </div>

        <div className="lg:w-2/3 w-full bg-white rounded-xl shadow border overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="bg-purple-100 text-purple-700 uppercase text-xs">
              <tr>
                <th className="p-3">Periode</th>
                <th className="p-3">Consommation</th>
                <th className="p-3">Stock rupture</th>
                <th className="p-3">Livraison</th>
                <th className="p-3">Stock rectifie</th>
                <th className="p-3">Commande</th>
                <th className="p-3">Quantite</th>
              </tr>
            </thead>

            <tbody>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;