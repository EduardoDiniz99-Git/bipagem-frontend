import React, { useState } from 'react';
import { db, auth } from '../firebase';
import BipagemPanel from './BipagemPanel';

const BipagemDTF = () => {
  const [inputCode, setInputCode] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bipagemData, setBipagemData] = useState(null);
  const [currentVerifications, setCurrentVerifications] = useState(0);

  const handleKeyDown = async (e) => {
    if (e.key !== "Enter") return;
    
    try {
      const code = inputCode.trim();
      if (!code) return;

      if (!auth.currentUser?.email) {
        alert("Usuário não autenticado. Faça login novamente.");
        return;
      }

      // Verifica se o código existe em bipagens
      const querySnapshot = await db.collection("bipagens")
        .where("code", "==", code)
        .get();

      if (querySnapshot.empty) {
        alert("Código não encontrado! Este código ainda não foi bipado pela Emissão.");
        setInputCode("");
        return;
      }

      // Busca dados do documento original
      const originalBip = querySnapshot.docs[0];
      const originalData = originalBip.data();
      setBipagemData(originalData);

      // Verifica quantidade total de itens e verificações existentes
      const totalItems = originalData.quantity || 1;
      const dtfRecordsSnapshot = await originalBip.ref
        .collection("dtf_records")
        .where('verificationType', '==', 'dtf')
        .get();

      const existingVerifications = dtfRecordsSnapshot.size;
      setCurrentVerifications(existingVerifications);

      if (existingVerifications >= totalItems) {
        alert(`Todos os ${totalItems} itens já foram verificados por DTF!`);
        setInputCode("");
        return;
      }

      // Verifica se o código já está na lista local
      if (scannedItems.some(item => item.code === code)) {
        alert("Este código já foi bipado nesta sessão!");
        setInputCode("");
        return;
      }

      const timestamp = new Date().toLocaleString("pt-BR");
      const newItem = { 
        code, 
        time: timestamp,
        userEmail: auth.currentUser.email,
        userRole: "DTF",
        status: "Pendente",
        bipId: originalBip.id,
        totalItems,
        nextItemNumber: existingVerifications + 1
      };

      setScannedItems(prev => [newItem, ...prev]);
      setInputCode("");

    } catch (err) {
      console.error("Erro ao verificar código:", err);
      alert("Erro ao verificar código: " + err.message);
    }
  };

  const handleSaveAll = async () => {
    if (scannedItems.length === 0) {
      alert("Não há itens para salvar!");
      return;
    }

    setLoading(true);

    try {
      const batch = db.batch();

      for (const item of scannedItems) {
        const dtfRef = db.collection("bipagens")
          .doc(item.bipId)
          .collection("dtf_records")
          .doc();

        batch.set(dtfRef, {
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          userRole: "DTF",
          timestamp: new Date(),
          status: "Verificado DTF",
          verificationType: 'dtf',
          itemNumber: item.nextItemNumber,
          totalItems: item.totalItems
        });

        // Se for o último item, atualiza o documento principal
        if (item.nextItemNumber === item.totalItems) {
          const bipagemRef = db.collection("bipagens").doc(item.bipId);
          batch.update(bipagemRef, {
            dtfVerified: true,
            status: 'DTF Verificado',
            lastUpdated: new Date()
          });
        }
      }

      await batch.commit();
      setScannedItems([]);
      setBipagemData(null);
      setCurrentVerifications(0);
      alert(`✅ ${scannedItems.length} verificações salvas com sucesso!`);

    } catch (err) {
      console.error("Erro ao salvar registros:", err);
      alert("❌ Erro ao salvar registros: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (idx) => {
    setScannedItems(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bipagem-dtf">
      <h1>Bipagem DTF</h1>
      
      <div className="bipagem-input-container">
        <input
          type="text"
          placeholder="Bipe a etiqueta aqui..."
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />
        <button 
          className="save-button"
          onClick={handleSaveAll}
          disabled={scannedItems.length === 0 || loading}
        >
          {loading ? "Salvando..." : `Salvar Todos (${scannedItems.length})`}
        </button>
      </div>

      {bipagemData?.quantity > 1 && (
        <div className="verification-progress">
          <div className="progress-text">
            Progresso: {currentVerifications} de {bipagemData.quantity} itens verificados
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(currentVerifications / bipagemData.quantity) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <section className="bipagem-table-section">
        <h2>Etiquetas Bipadas ({scannedItems.length})</h2>
        <div className="table-container">
          <table className="bipagem-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Horário</th>
                <th>Status</th>
                <th>Usuário</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {scannedItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{scannedItems.length - idx}</td>
                  <td>{item.code}</td>
                  <td>{item.time}</td>
                  <td>{item.status}</td>
                  <td>{item.userEmail}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(idx)}
                      disabled={loading}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default BipagemDTF;