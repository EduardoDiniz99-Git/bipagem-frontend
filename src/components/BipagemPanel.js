// src/components/BipagemPanel.js
import React, { useState, useEffect } from "react";
import { db, auth, firebase } from "../firebase";
import DuplicateModal from "./DuplicateModal";
import "../styles/DuplicateModal.css";
import { useNavigate } from 'react-router-dom';
import { identifyStore } from '../utils/storeMapping';

const BipagemPanel = ({ panelType = "Geral", setActiveMenu }) => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [scannedItems, setScannedItems] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateCodes, setDuplicateCodes] = useState([]);
  const [error, setError] = useState(null);
  const [uniqueCodesCount, setUniqueCodesCount] = useState(0);
  const [totalBipsCount, setTotalBipsCount] = useState(0);

  // Efeito para buscar role do usuário
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db
          .collection("users")
          .doc(auth.currentUser.uid)
          .get();
        
        if (userDoc.exists) {
          const role = userDoc.data().role;
          setUserRole(role);

          if (panelType === "Geral" && role === "DTF") {
            setError("Acesso negado: Usuários DTF devem utilizar a página específica de Bipagem DTF");
          }
        }
      } catch (err) {
        console.error("Erro ao buscar função do usuário:", err);
      }
    };

    fetchUserRole();
  }, [panelType]);

  // Efeito para atualizar contadores
  useEffect(() => {
    const uniqueCodes = new Set(scannedItems.map(item => item.code));
    setUniqueCodesCount(uniqueCodes.size);
    setTotalBipsCount(scannedItems.length);
  }, [scannedItems]);

  // Componente de mensagem de erro
  if (error) {
    return (
      <div className="access-denied-container">
        <div className="access-denied-message">
          <h2>⚠️ Acesso Negado</h2>
          <p>{error}</p>
          <button 
            className="redirect-button"
            onClick={() => setActiveMenu("bipagem-dtf")}
          >
            Ir para Bipagem DTF
          </button>
        </div>
      </div>
    );
  }

  const marketplaceOptions = [
    "Mercado Livre",
    "Shopee",
    "Shein",
    "Netshoes",
    "Amazon",
    "Magalu",
  ];

  // Função para inserir um novo BIP com sequentialId único
  const createBip = async (data) => {
    if (!auth.currentUser) {
      throw new Error("Usuário não autenticado");
    }

    try {
      // Check if code already exists for the same role
      const existingBips = await db
        .collection("bipagens")
        .where("code", "==", data.code)
        .where("userRole", "==", userRole)
        .get();

      // If code exists for the same role, prevent duplicate
      if (!existingBips.empty) {
        throw new Error(`Código já bipado pela função ${userRole}`);
      }

      // Regular bip creation logic
      const counterRef = db.collection("counters").doc("bipCounter");
      await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let current = 0;
        if (counterDoc.exists) {
          current = counterDoc.data().current || 0;
        }
        const novoId = current + 1;
        const newDocRef = db.collection("bipagens").doc();
        
        // Validate required data
        if (!data.code || !data.userEmail || !data.shippingDate || !data.marketplace) {
          throw new Error("Dados incompletos para criar o bip");
        }

        // Ensure user data matches current user
        if (data.userEmail !== auth.currentUser.email) {
          throw new Error("Dados do usuário não correspondem");
        }

        const bipData = {
          ...data,
          userRole,
          sequentialId: novoId,
          status: 'Pendente', // Adiciona status inicial
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email
        };

        transaction.set(newDocRef, bipData);

        // Update counter
        if (counterDoc.exists) {
          transaction.update(counterRef, { current: novoId });
        } else {
          transaction.set(counterRef, { current: novoId });
        }
      });

    } catch (error) {
      console.error("Erro na transação:", error);
      throw new Error(`Falha ao salvar o bip: ${error.message || "Erro desconhecido"}`);
    }
  };

  // Salva um BIP individual quando o usuário pressiona "Enter"
  const handleKeyDown = async (e) => {
    if (e.key !== "Enter") return;
    
    try {
      if (!shippingDate || !marketplace) {
        alert("Preencha Data de Envio e Marketplace antes de bipar.");
        return;
      }

      const code = inputCode.trim();
      if (!code) return;

      if (!auth.currentUser?.email) {
        alert("Usuário não autenticado. Faça login novamente.");
        return;
      }

      // Verifica apenas se o código existe na base de dados
      const existingBip = await db
        .collection("bipagens")
        .where("code", "==", code)
        .get();

      if (!existingBip.empty) {
        const bipData = existingBip.docs[0].data();
        alert(`Código ${code} já existe na base de dados!\nData/Hora: ${bipData.createdAt.toDate().toLocaleString("pt-BR")}\nUsuário: ${bipData.userEmail}`);
        setInputCode("");
        return;
      }

      // Se não existir na base, adiciona à lista local (permite duplicatas locais)
      const timestamp = new Date().toLocaleString("pt-BR");

      // Identifica a loja
      const storeName = identifyStore(code, marketplace);

      // Adiciona o novo item com a informação da loja
      const newItem = { 
        code,
        time: timestamp,
        shippingDate,
        marketplace,
        userEmail: auth.currentUser.email,
        store: storeName // Nova informação
      };
      
      setScannedItems((prev) => [newItem, ...prev]);
      setInputCode("");

    } catch (err) {
      console.error("Erro ao verificar código:", err);
      alert("Erro ao verificar código: " + err.message);
    }
  };

  // Exclui um item da lista local (antes dele ser enviado ao Firestore)
  const handleDelete = (idx) => {
    if (!window.confirm("Deseja excluir este registro?")) return;
    setScannedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Modifica o handleSaveAll para verificar duplicatas na base antes de salvar
  const handleSaveAll = async () => {
    if (!shippingDate || !marketplace) {
      return alert("Preencha Data de Envio e Marketplace antes de salvar.");
    }
    if (scannedItems.length === 0) {
      return alert("Nada para salvar!");
    }

    try {
      // Agrupa os itens por código
      const groupedItems = scannedItems.reduce((acc, item) => {
        if (!acc[item.code]) {
          acc[item.code] = {
            ...item,
            quantity: 1,
            items: [{ ...item }],
            store: item.store // Inclui a loja no agrupamento
          };
        } else {
          acc[item.code].quantity += 1;
          acc[item.code].items.push({ ...item });
        }
        return acc;
      }, {});

      // Verifica duplicatas na base
      const duplicates = [];
      const validItems = [];

      for (const [code, groupData] of Object.entries(groupedItems)) {
        const existingBip = await db
          .collection("bipagens")
          .where("code", "==", code)
          .get();

        if (existingBip.empty) {
          validItems.push(groupData);
        } else {
          duplicates.push({
            code: code,
            time: existingBip.docs[0].data().createdAt.toDate().toLocaleString("pt-BR"),
            user: existingBip.docs[0].data().userEmail
          });
        }
      }

      if (duplicates.length > 0) {
        let message = "Os seguintes códigos já existem na base:\n\n";
        duplicates.forEach(dup => {
          message += `Código: ${dup.code}\nData/Hora: ${dup.time}\nUsuário: ${dup.user}\n\n`;
        });
        alert(message);
        return;
      }

      // Salva os itens agrupados
      const batch = db.batch();
      for (const item of validItems) {
        const newDoc = db.collection("bipagens").doc();
        batch.set(newDoc, {
          code: item.code,
          createdAt: new Date(),
          shippingDate: item.shippingDate,
          marketplace: item.marketplace,
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          userRole: userRole,
          status: 'Pendente',
          store: item.store, // Adiciona a informação da loja
          quantity: item.quantity,
          items: item.items.map(subItem => ({
            time: subItem.time,
            createdAt: new Date()
          })),
          totalItems: item.quantity
        });
      }

      await batch.commit();

      // Mostra estatísticas
      const uniqueCodes = Object.keys(groupedItems).length;
      const totalItems = scannedItems.length;
      
      alert(`✅ Bips salvos com sucesso!\n\nCódigos únicos: ${uniqueCodes}\nTotal de itens: ${totalItems}`);
      setScannedItems([]);

    } catch (err) {
      console.error("Erro ao salvar registros:", err);
      alert("❌ Erro ao salvar: " + err.message);
    }
  };

  const handleBipagem = async (data) => {
    try {
      await db.runTransaction(async (transaction) => {
        // Verifica se já existe um registro com o mesmo código
        const existingDoc = await transaction.get(
          db.collection("bipagens").where("code", "==", data.code)
        );

        if (!existingDoc.empty) {
          throw new Error("Código já registrado");
        }

        // Cria novo registro
        const newDocRef = db.collection("bipagens").doc();
        transaction.set(newDocRef, {
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          userId: auth.currentUser.uid,
          status: 'Pendente'
        });
      });
    } catch (error) {
      console.error("Erro na transação:", error);
      throw error;
    }
  }

  return (
    <>
      {/* Seletor de Data e Marketplace */}
      <div className="bipagem-input-container">
        <input
          type="date"
          value={shippingDate}
          onChange={(e) => setShippingDate(e.target.value)}
        />
        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
        >
          <option value="">Selecione o Marketplace</option>
          {marketplaceOptions.map((mkt) => (
            <option key={mkt} value={mkt}>
              {mkt}
            </option>
          ))}
        </select>
      </div>

      {/* Input de código e botão de "Salvar Todos" */}
      <div className="bipagem-input-container">
        <input
          type="text"
          placeholder="Bipe a etiqueta aqui..."
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button className="save-button" onClick={handleSaveAll}>
          Salvar Todos
        </button>
      </div>

      {/* Tabela local de bipagens */}
      <section className="bipagem-table-section">
        <h2>Etiquetas Bipadas ({scannedItems.length})</h2>
        <div className="table-container">
          <table className="bipagem-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Qtd. Itens</th>
                <th>Horário</th>
                <th>Data de Envio</th>
                <th>Marketplace</th>
                <th>Loja</th> {/* Nova coluna */}
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {scannedItems.map((item, idx) => {
                const itemCount = scannedItems.filter(i => i.code === item.code).length;
                const isFirstOccurrence = scannedItems.findIndex(i => i.code === item.code) === idx;
                
                if (!isFirstOccurrence) return null;

                return (
                  <tr key={idx}>
                    <td>{scannedItems.length - idx}</td>
                    <td>{item.code}</td>
                    <td>{itemCount}</td>
                    <td>{item.time}</td>
                    <td>{item.shippingDate}</td>
                    <td>{item.marketplace}</td>
                    <td>{item.store}</td> {/* Nova coluna */}
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => handleDelete(idx)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bipagem-stats">
        <p>Códigos únicos: {uniqueCodesCount}</p>
        <p>Total de bipagens: {totalBipsCount}</p>
      </div>

      {showDuplicates && (
        <DuplicateModal 
          duplicates={duplicateCodes} 
          onClose={() => setShowDuplicates(false)} 
        />
      )}
    </>
  );
};

export default BipagemPanel;
