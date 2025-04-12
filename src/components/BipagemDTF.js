import React, { useState } from 'react';
import { db, auth } from '../firebase';
import BipagemPanel from './BipagemPanel';

const BipagemDTF = () => {
  const [inputCode, setInputCode] = useState('');
  const [scannedItems, setScannedItems] = useState([]);

  const handleKeyDown = async (e) => {
    if (e.key !== "Enter") return;
    
    try {
      const code = inputCode.trim();
      if (!code) return;

      if (!auth.currentUser?.email) {
        alert("Usuário não autenticado. Faça login novamente.");
        return;
      }

      // Check if code exists in bipagens
      const querySnapshot = await db.collection("bipagens")
        .where("code", "==", code)
        .get();

      if (querySnapshot.empty) {
        alert("Código não encontrado! Este código ainda não foi bipado pela Emissão.");
        setInputCode("");
        return;
      }

      // Check if code was already scanned by any DTF user
      for (const doc of querySnapshot.docs) {
        const dtfRecords = await doc.ref.collection("dtf_records").get();
        if (!dtfRecords.empty) {
          alert("Este código já foi verificado por DTF!");
          setInputCode("");
          return;
        }
      }

      const timestamp = new Date().toLocaleString("pt-BR");
      const newItem = { 
        code, 
        time: timestamp,
        userEmail: auth.currentUser.email,
        userRole: "DTF",
        status: "Verificado DTF"
      };

      // Add to Firebase
      const originalBip = querySnapshot.docs[0];
      await db.collection("bipagens")
        .doc(originalBip.id)
        .collection("dtf_records")
        .add({
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          userRole: "DTF",
          timestamp: new Date(),
          status: "Verificado DTF"
        });

      // Update local state
      setScannedItems(prev => [newItem, ...prev]);
      setInputCode("");

    } catch (err) {
      console.error("Erro ao salvar bipagem:", err);
      alert("Erro ao salvar bipagem: " + err.message);
    }
  };

  const handleSaveAll = async () => {
    if (scannedItems.length === 0) {
      alert("Não há itens para salvar!");
      return;
    }

    try {
      // Save all items
      for (const item of scannedItems) {
        await db.collection("bipagens")
          .where("code", "==", item.code)
          .get()
          .then(async (querySnapshot) => {
            if (querySnapshot.empty) {
              console.warn(`Código não encontrado: ${item.code}`);
              return;
            }

            const originalBip = querySnapshot.docs[0];
            await db.collection("bipagens")
              .doc(originalBip.id)
              .collection("dtf_records")
              .add({
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                userRole: "DTF",
                timestamp: new Date(),
                status: "Verificado DTF"
              });
          });
      }

      // Clear local state after saving
      setScannedItems([]);
      alert("✅ Registros salvos com sucesso!");

    } catch (err) {
      console.error("Erro ao salvar registros:", err);
      alert("❌ Erro ao salvar registros: " + err.message);
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
          autoFocus
        />
        <button 
          className="save-button"
          onClick={handleSaveAll}
          disabled={scannedItems.length === 0}
        >
          Salvar Todos ({scannedItems.length})
        </button>
      </div>

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