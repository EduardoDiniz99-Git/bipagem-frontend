import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { db, auth } from "../firebase";
import * as XLSX from "xlsx";
import "../styles/HistoryPanel.css";
import '../styles/HistoryPanel.css';
import '../styles/BipagemCheckout.css';

const HistoryPanel = ({ autoLoad = true }) => {
  const location = useLocation();
  // =========================================
  // Estados principais
  // =========================================
  const [historyItems, setHistoryItems] = useState([]); // Lista de bipagens
  const [loadingHistory, setLoadingHistory] = useState(false); // Controle de carregamento
  const [userRole, setUserRole] = useState(''); // Função do usuário (admin ou normal)
  const [isMounted, setIsMounted] = useState(true); // Controle de componente montado

  // =========================================
  // Estados de paginação
  // =========================================
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // Quantidade de itens por página
  const [pageCursors, setPageCursors] = useState([]); // Cursores para paginação do Firestore
  const [hasNextPage, setHasNextPage] = useState(true);

  // =========================================
  // Estados de filtros
  // =========================================
  const [searchTerm, setSearchTerm] = useState(""); // Busca por código
  const [marketplaceFilter, setMarketplaceFilter] = useState(""); // Filtro de marketplace
  const [startDate, setStartDate] = useState(getFirstDayOfMonth()); // Data inicial
  const [endDate, setEndDate] = useState(getLastDayOfMonth()); // Data final

  // =========================================
  // Estados para registros DTF
  // =========================================
  const [dtfRecords, setDtfRecords] = useState({}); // Registros de verificação DTF
  const [expandedRow, setExpandedRow] = useState(null); // Controle de linha expandida

  // =========================================
  // Funções utilitárias
  // =========================================
  
  // Retorna o primeiro dia do mês atual
  function getFirstDayOfMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split('T')[0];
  }

  // Retorna o último dia do mês atual
  function getLastDayOfMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
  }

  // =========================================
  // Efeitos principais
  // =========================================

  // Limpa o estado quando o componente é desmontado
  useEffect(() => {
    return () => setIsMounted(false);
  }, []);

  // Carrega a função do usuário atual
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db
          .collection("users")
          .doc(auth.currentUser.uid)
          .get();
        
        if (userDoc.exists) {
          setUserRole(userDoc.data().role);
        }
      } catch (err) {
        console.error("Erro ao buscar função do usuário:", err);
      }
    };

    fetchUserRole();
  }, []);

  // Carrega dados iniciais quando o componente monta
  useEffect(() => {
    if (autoLoad) {
      loadFilteredData();
    }
  }, [autoLoad]);

  // Aplica filtros com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (startDate && endDate) {
        loadFilteredData();
      }
    }, 500); // Espera 500ms antes de aplicar os filtros

    return () => clearTimeout(timer);
  }, [startDate, endDate, marketplaceFilter]);

  useEffect(() => {
    if (location.state?.filters) {
      const { startDate, endDate, marketplaceFilter } = location.state.filters;
      
      // Aplica os filtros recebidos
      setStartDate(startDate || '');
      setEndDate(endDate || '');
      setMarketplaceFilter(marketplaceFilter || '-');
      
      // Carrega os dados com os novos filtros
      loadFilteredData();
      
      // Limpa o state para não reaplicar os filtros
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // =========================================
  // Funções de carregamento de dados
  // =========================================

  // Função principal de carregamento com filtros
  const loadFilteredData = async () => {
    if (!isMounted) return;
    setLoadingHistory(true);

    try {
      let query = db.collection("bipagens");

      // Aplica filtros de data
      if (startDate && endDate) {
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);

        query = query
          .where("createdAt", ">=", startDateTime)
          .where("createdAt", "<=", endDateTime);
      }

      // Aplica filtro de marketplace
      if (marketplaceFilter && marketplaceFilter !== "-") {
        query = query.where("marketplace", "==", marketplaceFilter);
      }

      // Ordenação e limite
      query = query
        .orderBy("createdAt", "desc")
        .limit(pageSize);

      const snapshot = await query.get();

      // Mapeia documentos para o formato necessário
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        uniqueId: doc.id,
        sequentialId: doc.data().sequentialId || 'N/A',
        time: doc.data().createdAt?.toDate().toLocaleString("pt-BR") || "-",
        email: doc.data().userEmail || "-",
        userRole: doc.data().userRole || "-",
        shippingDate: doc.data().shippingDate || "-",
        marketplace: doc.data().marketplace || "-"
      }));

      setHistoryItems(items);
      setCurrentPage(1);
      setHasNextPage(items.length === pageSize);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar dados: " + error.message);
    } finally {
      if (isMounted) {
        setLoadingHistory(false);
      }
    }
  };

  // Add a useEffect to watch filter changes
  useEffect(() => {
    // If all filters are empty, reload the first page
    if (!searchTerm && !startDate && !endDate && !marketplaceFilter) {
      fetchPage(1);
    }
  }, [searchTerm, startDate, endDate, marketplaceFilter]);

  const fetchInitialData = async () => {
    if (!isMounted) return;
    
    setLoadingHistory(true);
    try {
      const snapshot = await db
        .collection("bipagens")
        .orderBy("sequentialId", "desc")
        .limit(pageSize)
        .get();

      if (!isMounted) return;

      const items = snapshot.docs.map(doc => mapDocToItem(doc));
      setHistoryItems(items);
      
      if (items.length < pageSize) {
        setHasNextPage(false);
      }

      console.log("Dados carregados:", items); // Debug
    } catch (error) {
      if (isMounted) {
        console.error("Erro ao carregar dados:", error);
        alert("Erro ao carregar histórico: " + error.message);
      }
    } finally {
      if (isMounted) {
        setLoadingHistory(false);
      }
    }
  };

  // Modifique a função fetchPage para melhor feedback
  const fetchPage = async (page) => {
    if (!isMounted) return;
    
    setLoadingHistory(true);
    try {
      let query = db
        .collection("bipagens")
        .orderBy("sequentialId", "desc")
        .limit(pageSize);

      if (page > 1 && pageCursors[page - 2]) {
        query = query.startAfter(pageCursors[page - 2]);
      }

      const snap = await query.get();
      
      if (!isMounted) return;

      if (snap.empty && page > 1) {
        alert("Não há mais registros para exibir.");
        return;
      }

      const newDocs = snap.docs.map(doc => mapDocToItem(doc));
      setHistoryItems(newDocs);

      // Atualiza cursores para paginação
      if (page === pageCursors.length + 1 && snap.docs.length > 0) {
        setPageCursors(prev => [...prev, snap.docs[snap.docs.length - 1]]);
      }

      setHasNextPage(newDocs.length === pageSize);
      setCurrentPage(page);

      // Debug
      console.log(`Página ${page} carregada:`, newDocs.length, "registros");
    } catch (err) {
      if (isMounted) {
        console.error("Erro ao buscar página:", err);
        alert("Erro ao carregar registros: " + err.message);
      }
    } finally {
      if (isMounted) {
        setLoadingHistory(false);
      }
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      fetchPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchPage(currentPage - 1);
    }
  };

  // Modifique a função de busca global
  const handleGlobalSearch = async () => {
    if (!searchTerm.trim()) {
      alert("Digite um código para pesquisar");
      return;
    }
  
    setLoadingHistory(true);
    try {
      const query = db
        .collection("bipagens")
        .where("code", "==", searchTerm.trim());
  
      const snapshot = await query.get();
      
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        uniqueId: doc.id,
        sequentialId: doc.data().sequentialId || 'N/A',
        time: doc.data().createdAt?.toDate().toLocaleString("pt-BR") || "-",
        email: doc.data().userEmail || "-",
        userRole: doc.data().userRole || "-",
        shippingDate: doc.data().shippingDate || "-",
        marketplace: doc.data().marketplace || "-"
      }));
  
      setHistoryItems(items);
      setCurrentPage(1);
      setPageCursors([]);
      setHasNextPage(false);
  
      if (items.length === 0) {
        alert("Nenhum registro encontrado com este código.");
      }
  
    } catch (error) {
      console.error("Erro na busca:", error);
      alert("Erro ao realizar busca: " + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Modifique a função mapDocToItem para incluir a verificação de registros DTF
  const mapDocToItem = (doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      uniqueId: `${doc.id}-${d.sequentialId}`,
      sequentialId: d.sequentialId || 'N/A', // Inclui o ID sequencial
      code: d.code,
      time: d.createdAt ? d.createdAt.toDate().toLocaleString("pt-BR") : "",
      email: d.userEmail || "-",
      userRole: d.userRole || "-",
      shippingDate: d.shippingDate || "-",
      marketplace: d.marketplace || "-",
      hasRecords: true // Sempre será true pois verificaremos os registros DTF
    };
  };

  const handleDeleteHistory = async (id) => {
    try {
      // Verifica se o usuário atual é admin
      const userDoc = await db
        .collection("users")
        .doc(auth.currentUser.uid)
        .get();
  
      if (!userDoc.exists || userDoc.data().role !== 'admin') {
        alert("Somente administradores podem excluir registros!");
        return;
      }
  
      if (!window.confirm("Excluir este registro permanentemente?")) return;
      
      setLoadingHistory(true);
  
      // Primeiro exclui os registros DTF
      const dtfSnapshot = await db
        .collection("bipagens")
        .doc(id)
        .collection("dtf_records")
        .get();
  
      // Usa batch para excluir subcoleções
      const batch = db.batch();
      dtfSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
  
      // Adiciona a exclusão do documento principal ao batch
      batch.delete(db.collection("bipagens").doc(id));
  
      // Executa todas as operações de exclusão
      await batch.commit();
  
      // Atualiza a UI
      setHistoryItems(prev => prev.filter(item => item.id !== id));
      setDtfRecords(prev => {
        const newRecords = { ...prev };
        delete newRecords[id];
        return newRecords;
      });
      
      alert("✅ Registro excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir registro:", err);
      alert("❌ Erro ao excluir: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteAllHistory = async () => {
    try {
      // Verifica se o usuário atual é admin
      const userDoc = await db
        .collection("users")
        .doc(auth.currentUser.uid)
        .get();
  
      if (!userDoc.exists || userDoc.data().role !== 'admin') {
        alert("Somente administradores podem excluir registros!");
        return;
      }
  
      if (!window.confirm("Excluir todos os registros? Ação irreversível.")) return;
  
      const snapshot = await db.collection("bipagens").get();
      if (snapshot.empty) {
        alert("Não há registros para excluir.");
        return;
      }
  
      // Usa batch para excluir todos os registros
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;
  
      for (const doc of snapshot.docs) {
        // Primeiro adiciona a exclusão do documento principal
        batch.delete(doc.ref);
        operationCount++;
  
        // Se atingir o limite de 500 operações, cria um novo batch
        if (operationCount === 500) {
          batches.push(batch);
          batch = db.batch();
          operationCount = 0;
        }
      }
  
      // Adiciona o último batch se tiver operações pendentes
      if (operationCount > 0) {
        batches.push(batch);
      }
  
      // Executa todos os batches
      await Promise.all(batches.map(batch => batch.commit()));
  
      // Atualiza a UI
      setHistoryItems([]);
      setCurrentPage(1);
      setPageCursors([]);
      setHasNextPage(false);
      alert(`✅ ${snapshot.size} registros excluídos!`);
    } catch (err) {
      console.error("Erro ao excluir todos registros:", err);
      alert("❌ Erro ao excluir todos os registros: " + err.message);
    }
  };

  const handleExportXLSX = async () => {
    try {
      const exportData = [];
      
      // Para cada item do histórico
      for (const item of filteredItems) {
        // Busca os registros DTF do item
        const dtfRecordsSnap = await db
          .collection("bipagens")
          .doc(item.id)
          .collection("dtf_records")
          .where("status", "==", "Verificado DTF")
          .get();
  
        const dtfVerifications = dtfRecordsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            dtfTimestamp: data.timestamp?.toDate().toLocaleString("pt-BR") || "-",
            dtfUser: data.userEmail || "-",
            dtfStatus: data.status || "-"
          };
        });
  
        // Cria o registro base
        const baseRecord = {
          "ID Sequencial": item.sequentialId,
          "Código": item.code,
          "Data/Horário Criação": item.time,
          "Data de Envio": item.shippingDate,
          "Marketplace": item.marketplace,
          "Usuário Criação": item.email,
          "Função Usuário": item.userRole,
        };
  
        if (dtfVerifications.length > 0) {
          // Adiciona cada verificação DTF como uma linha separada
          dtfVerifications.forEach((dtf, index) => {
            exportData.push({
              ...baseRecord,
              "Verificação DTF #": index + 1,
              "Data/Hora Verificação DTF": dtf.dtfTimestamp,
              "Usuário DTF": dtf.dtfUser,
              "Status DTF": dtf.dtfStatus
            });
          });
        } else {
          // Se não houver verificações DTF, adiciona uma linha com valores vazios
          exportData.push({
            ...baseRecord,
            "Verificação DTF #": "-",
            "Data/Hora Verificação DTF": "-",
            "Usuário DTF": "-",
            "Status DTF": "Não verificado"
          });
        }
      }
  
      // Configura a planilha
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bipagens");
  
      // Ajusta largura das colunas
      const colWidths = [
        { wch: 15 }, // ID Sequencial
        { wch: 20 }, // Código
        { wch: 20 }, // Data/Horário Criação
        { wch: 15 }, // Data de Envio
        { wch: 15 }, // Marketplace
        { wch: 25 }, // Usuário Criação
        { wch: 15 }, // Função Usuário
        { wch: 15 }, // Verificação DTF #
        { wch: 20 }, // Data/Hora Verificação DTF
        { wch: 25 }, // Usuário DTF
        { wch: 15 }, // Status DTF
      ];
      ws['!cols'] = colWidths;
  
      // Salva o arquivo
      XLSX.writeFile(wb, `bipagens_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  
      alert("✅ Planilha exportada com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar planilha:", error);
      alert("❌ Erro ao exportar planilha: " + error.message);
    }
  };

  const fetchDtfRecords = async (bipId) => {
    try {
      // Busca registros DTF salvos
      const records = await db
        .collection("bipagens")
        .doc(bipId)
        .collection("dtf_records")
        .where("status", "==", "Verificado DTF")
        .get();

      const mappedRecords = records.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toLocaleString("pt-BR") || "-"
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Ordenação local

      setDtfRecords(prev => ({
        ...prev,
        [bipId]: mappedRecords
      }));
      setExpandedRow(bipId);
    } catch (error) {
      console.error("Erro ao buscar registros DTF:", error);
      alert("Erro ao buscar verificações DTF: " + error.message);
    }
  };

  const handleToggleRow = async (bipId) => {
    if (expandedRow === bipId) {
      // Se clicar no mesmo item, fecha o menu
      setExpandedRow(null);
    } else {
      // Se clicar em um novo item, busca os dados e abre
      await fetchDtfRecords(bipId);
    }
  };

  const marketplaceOptions = [
    "-",
    "Mercado Livre",
    "Shopee",
    "Shein",
    "Netshoes",
    "Amazon",
    "Magalu",
  ];

  // Modifique a lógica de filtragem
  const filteredItems = React.useMemo(() => {
    return historyItems
      .filter((item) => {
        // Converte as strings de data para objetos Date para comparação
        const itemDate = item.createdAt ? new Date(item.createdAt.toDate()) : null;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        end?.setHours(23, 59, 59, 999); // Define para último momento do dia

        // Filtro de data
        if (start && end && itemDate) {
          if (itemDate < start || itemDate > end) return false;
        }

        // Filtro de marketplace
        if (marketplaceFilter && marketplaceFilter !== "-") {
          if (item.marketplace !== marketplaceFilter) return false;
        }

        // Filtro por código
        if (searchTerm && !item.code.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Ordena por data de criação, mais recente primeiro
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
  }, [historyItems, startDate, endDate, marketplaceFilter, searchTerm]);

  // Único useEffect para carregamento inicial
  useEffect(() => {
    if (autoLoad) {
      const initialLoad = async () => {
        setLoadingHistory(true);
        try {
          const startDateTime = new Date(startDate);
          startDateTime.setHours(0, 0, 0, 0);
          
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);

          const query = db
            .collection("bipagens")
            .where("createdAt", ">=", startDateTime)
            .where("createdAt", "<=", endDateTime)
            .orderBy("createdAt", "desc")
            .limit(pageSize);

          const snapshot = await query.get();

          const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            uniqueId: doc.id,
            sequentialId: doc.data().sequentialId || 'N/A',
            time: doc.data().createdAt?.toDate().toLocaleString("pt-BR") || "-",
            email: doc.data().userEmail || "-",
            userRole: doc.data().userRole || "-",
            shippingDate: doc.data().shippingDate || "-",
            marketplace: doc.data().marketplace || "-"
          }));

          console.log("Dados iniciais carregados:", items.length);
          setHistoryItems(items);
          
          if (snapshot.docs.length > 0) {
            setPageCursors([snapshot.docs[snapshot.docs.length - 1]]);
          }
          
          setHasNextPage(items.length === pageSize);
          setCurrentPage(1);

        } catch (error) {
          console.error("Erro ao carregar dados iniciais:", error);
        } finally {
          setLoadingHistory(false);
        }
      };

      initialLoad();
    }
  }, [autoLoad]); // Remove pageSize da dependência

  // Effect para filtros, com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (startDate && endDate) {
        loadFilteredData();
      }
    }, 500); // Espera 500ms antes de aplicar os filtros

    return () => clearTimeout(timer);
  }, [startDate, endDate, marketplaceFilter]);

  useEffect(() => {
    console.log("Estado atual:", {
      itemsCount: historyItems.length,
      loading: loadingHistory,
      currentPage,
      hasNextPage,
      filters: {
        startDate,
        endDate,
        marketplaceFilter,
        searchTerm
      }
    });
  }, [historyItems, loadingHistory, currentPage, hasNextPage, startDate, endDate, marketplaceFilter, searchTerm]);

  return (
    <>
      <div className="history-filters-container">
        <div className="history-filter-group">
          <label>Código:</label>
          <input
            type="text"
            placeholder="Pesquisar por código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={handleGlobalSearch} disabled={loadingHistory}>
            Buscar Bip
          </button>
        </div>

        <div className="history-filter-group">
          <label>Data Início:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              // Chama loadFilteredData se ambas as datas estiverem preenchidas
              if (e.target.value && endDate) {
                loadFilteredData();
              }
            }}
          />
        </div>

        <div className="history-filter-group">
          <label>Data Fim:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              // Chama loadFilteredData se ambas as datas estiverem preenchidas
              if (startDate && e.target.value) {
                loadFilteredData();
              }
            }}
          />
        </div>

        <div className="history-filter-group">
          <label>Marketplace:</label>
          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
          >
            {marketplaceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filters-actions">
          {userRole === 'admin' && (
            <>
              <button className="delete-all-button" onClick={handleDeleteAllHistory}>
                Excluir Todos
              </button>
              <button className="export-button" onClick={handleExportXLSX}>
                Exportar XLSX
              </button>
            </>
          )}
        </div>
      </div>

      <section className="bipagem-table-section">
        <h2>Histórico de Bipagens</h2>
        {loadingHistory && (
          <div className="loading-indicator">
            <p>Buscando registros...</p>
          </div>
        )}
        <div className="table-container">
          <table className="bipagem-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Data/Horário Criação</th>
                <th>Data de Envio</th>
                <th>Marketplace</th>
                <th>Usuário</th>
                <th>Função</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems && filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <React.Fragment key={item.uniqueId}>
                    <tr>
                      <td>{item.sequentialId}</td>
                      <td>
                        {item.code}
                        <button
                          className={`expand-button ${expandedRow === item.id ? 'expanded' : ''}`}
                          onClick={() => handleToggleRow(item.id)}
                        >▼</button>
                      </td>
                      <td>{item.time}</td>
                      <td>{item.shippingDate}</td>
                      <td>{item.marketplace}</td>
                      <td>{item.email}</td>
                      <td>{item.userRole || "-"}</td>
                      <td>
                        {userRole === 'admin' && (
                          <button 
                            className="delete-button" 
                            onClick={() => handleDeleteHistory(item.id)}
                          >Excluir</button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === item.id && (
                      <tr className="dtf-records-row">
                        <td colSpan={8}>
                          <div className="dtf-records-container">
                            <h4>Verificações DTF</h4>
                            <table className="dtf-records-table">
                              <thead>
                                <tr>
                                  <th>Data/Hora</th>
                                  <th>Usuário DTF</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dtfRecords[item.id]?.length > 0 ? (
                                  dtfRecords[item.id].map(record => (
                                    <tr key={record.id}>
                                      <td>{record.timestamp}</td>
                                      <td>{record.userEmail}</td>
                                      <td>
                                        <span className="verification-status">
                                          {record.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={3}>Este código ainda não foi verificado pela DTF</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan={8}>{loadingHistory ? 'Carregando...' : 'Nenhum registro encontrado.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCursors.length > 0 && hasNextPage && !loadingHistory && (
          <div
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loadingHistory}
            >
              Anterior
            </button>
            <span>Página {currentPage}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasNextPage || loadingHistory}
            >
              Próxima
            </button>
          </div>
        )}
      </section>
    </>
  );
};

export default HistoryPanel;
