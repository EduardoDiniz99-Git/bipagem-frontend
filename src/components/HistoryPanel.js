import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { db, auth } from "../firebase";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify'; // Adiciona esta linha
import "../styles/HistoryPanel.css"; // Importação do CSS

// Adicione este mapeamento no início do arquivo, junto com as outras constantes
const storesByMarketplace = {
  "Mercado Livre": [
    'LUISCARLOS',
    'Vanio',
    'JMGarcia',
    'João Mota Novo',
    'Edna',
    'Nagila',
    'Eguinaldo',
    'Daiane',
  ],
  "Shopee": [
    'StreetCulture',
    'JM Styles',
    'Maravs Confecções',
    'Style Haven',
    'PlazaShop',
    'Gin Tropical',
    'JM Styles',
    'T-Shirt',
    'Now Kids',
    'FHC',
    'Close Friends',
    'Oversized Store',
  ],
  "Shein": [
    'Maravs',
    'JM Styles',
    'Out Fit'
  ],
  "Netshoes": [
    'Maravs',
    'Gin Tropical',
    'Daniel Bueno',
    'Padrão93',
  ],
  "Amazon": [
    'Maravs',
  ],
  "Magalu": [
    'Luis Carlos'
  ]
};

const HistoryPanel = ({ autoLoad = true, initialFilters = null }) => {
  // =========================================
  // Estados principais
  // =========================================
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // =========================================
  // Estados de paginação
  // =========================================
  const PAGE_SIZE = 50;  // Constante para tamanho da página
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [firstDoc, setFirstDoc] = useState(null); // Adicione estado para firstDoc
  const [hasNextPage, setHasNextPage] = useState(true);
  const [pageCursors, setPageCursors] = useState([]); // Adicione estado para pageCursors

  const location = useLocation();
  // =========================================
  // Estados principais
  // =========================================
  const [userRole, setUserRole] = useState(''); // Função do usuário (admin ou normal)

  // =========================================
  // Estados de filtros
  // =========================================
  const [searchTerm, setSearchTerm] = useState(""); // Busca por código
  const [marketplaceFilter, setMarketplaceFilter] = useState(initialFilters?.marketplaceFilter || '-'); // Filtro de marketplace
  const [startDate, setStartDate] = useState(''); // Data inicial
  const [endDate, setEndDate] = useState(''); // Data final

  // Adicione estes estados junto com os outros estados
  const [shippingDateFilter, setShippingDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('-');

  // Adicione as opções de status
  const statusOptions = [
    '-',
    'Pendente',
    'DTF',
    'Enviado',
    'Atrasado'  // Adiciona a opção Atrasado
  ];

  // Adicione junto aos outros estados no início do componente
  const [storeFilter, setStoreFilter] = useState('-');

  // Adicione as opções de loja junto às outras constantes
  const storeOptions = [
    '-',
    'LUISCARLOS',
    'Vanio',
    'JMGarcia',
    'João Mota Novo',
    'Edna',
    'Nagila',
    'L A Freitas',
    'Eguinaldo',
    'Daiane',
    'StreetCulture',
    'JM Styles',
    'Maravs Confecções',
    'Style Haven',
    'PlazaShop',
    'Gin Tropical',
    'T-Shirt',
    'Now Kids',
    'FHC',
    'Close Friends',
    'Oversized Store',
    'Maravs',
    'Out Fit',
    'Padrão93',
    'Luis Carlos'
  ];

  // =========================================
  // Estados para registros DTF
  const [dtfRecords, setDtfRecords] = useState({}); // Registros de verificação DTF
  const [expandedRow, setExpandedRow] = useState(null); // Controle de linha expandida

  // Adicione estes estados no início do componente
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

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
      const filters = location.state.filters;
      
      // Aplica os filtros
      setStartDate(filters.startDate);
      setEndDate(filters.endDate);
      setMarketplaceFilter(filters.marketplaceFilter);

      // Carrega os dados com os novos filtros
      loadFilteredData();
      
      // Limpa o state para não reaplicar os filtros
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // No início do componente, modifique o useEffect que observa os filtros iniciais
  useEffect(() => {
    if (location.state?.filters) {
      const filters = location.state.filters;
      
      // Aplica os filtros recebidos
      if (filters.shippingDateFilter) {
        setShippingDateFilter(filters.shippingDateFilter);
      }
      setMarketplaceFilter(filters.marketplaceFilter || '-');
      setStatusFilter(filters.statusFilter || '-');
      
      // Carrega os dados com os novos filtros
      loadFilteredData();
      
      // Limpa o state para não reaplicar os filtros
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const savedFilters = JSON.parse(localStorage.getItem('lastHistoryFilters'));
    
    if (savedFilters) {
      if (savedFilters.shippingDateFilter) {
        setShippingDateFilter(savedFilters.shippingDateFilter);
      }
      if (savedFilters.marketplaceFilter) {
        setMarketplaceFilter(savedFilters.marketplaceFilter);
      }
      if (savedFilters.statusFilter) {
        setStatusFilter(savedFilters.statusFilter);
      }
      
      // Carrega os dados com os novos filtros
      loadFilteredData();
    }
  }, []);

  useEffect(() => {
    const savedFilters = JSON.parse(localStorage.getItem('lastHistoryFilters'));
    
    if (savedFilters) {
      // Aplica as datas de início e fim
      if (savedFilters.startDate) {
        setStartDate(savedFilters.startDate);
      }
      if (savedFilters.endDate) {
        setEndDate(savedFilters.endDate);
      }
      
      // Aplica os outros filtros
      setMarketplaceFilter(savedFilters.marketplaceFilter || '-');
      setStatusFilter(savedFilters.statusFilter || '-');
      setStoreFilter(savedFilters.storeFilter || '-');
      setShippingDateFilter(savedFilters.shippingDateFilter || '');
      
      // Carrega os dados com os novos filtros
      loadFilteredData();
    }
  }, []);

  // =========================================
  // Funções de carregamento de dados
  // =========================================

  // Modifique a função loadFilteredData
const loadFilteredData = async (pageDirection = 'next') => {
  if (!isMounted) return;
  setLoadingHistory(true);

  try {
    let query = db.collection("bipagens");

    // Aplica filtros
    if (statusFilter && statusFilter !== "-") {
      query = query.where("status", "==", statusFilter);
    }
    if (marketplaceFilter && marketplaceFilter !== "-") {
      query = query.where("marketplace", "==", marketplaceFilter);
    }
    if (storeFilter && storeFilter !== "-") {
      query = query.where("store", "==", storeFilter);
    }

    // Ordenação padrão
    query = query.orderBy("createdAt", "desc");

    // Aplica paginação
    if (pageDirection === 'next' && lastDoc) {
      query = query.startAfter(lastDoc);
    } else if (pageDirection === 'prev' && firstDoc) {
      query = query.endBefore(firstDoc).limitToLast(PAGE_SIZE);
    }

    query = query.limit(PAGE_SIZE);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      setHasNextPage(false);
      return;
    }

    // Salva os documentos de referência para paginação
    setFirstDoc(snapshot.docs[0]);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

    let items = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Converte data atual para YYYY-MM-DD
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
    
      // Define o status baseado na data de envio
      let status = data.status || "Pendente";
      
      if (data.shippingDate && (status === "Pendente" || !status)) {
        // Compara as strings diretamente no formato YYYY-MM-DD
        if (data.shippingDate < todayStr) {
          status = "Atrasado";
        } else {
          status = "Pendente";
        }
      }
    
      return {
        ...data,
        id: doc.id,
        uniqueId: doc.id,
        sequentialId: data.sequentialId || 'N/A',
        time: data.createdAt?.toDate().toLocaleString("pt-BR") || "-",
        email: data.userEmail || "-",
        userRole: data.userRole || "-",
        shippingDate: data.shippingDate || "-",
        marketplace: data.marketplace || "-",
        store: data.store || "-",
        status: status
      };
    });

    setHistoryItems(items);
    setHasNextPage(snapshot.docs.length === PAGE_SIZE);

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    toast.error("Erro ao carregar dados: " + error.message);
  } finally {
    setLoadingHistory(false);
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
        .limit(PAGE_SIZE)
        .get();

      if (!isMounted) return;

      const items = snapshot.docs.map(doc => mapDocToItem(doc));
      setHistoryItems(items);
      
      if (items.length < PAGE_SIZE) {
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
        .limit(PAGE_SIZE);

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

      setHasNextPage(newDocs.length === PAGE_SIZE);
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

  // Modifique as funções de navegação
const handleNextPage = () => {
  if (hasNextPage && !loadingHistory) {
    setCurrentPage(prev => prev + 1);
    loadFilteredData('next');
  }
};

const handlePrevPage = () => {
  if (currentPage > 1 && !loadingHistory) {
    setCurrentPage(prev => prev - 1);
    loadFilteredData('prev');
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
        marketplace: doc.data().marketplace || "-",
        status: doc.data().status || "Pendente" // Adiciona o status
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
    const data = doc.data();
    let status = 'Pendente';
  
    // Primeiro verifica se existe verificação DTF na subcoleção
    const hasDtfVerification = data.dtfVerified || 
      (data.verifications && data.verifications.some(v => v.type === 'dtf' || v.userRole === 'DTF'));
  
    // Depois verifica verificação de Checkout
    const hasCheckoutVerification = data.checkoutVerified || 
      (data.verifications && data.verifications.some(v => v.type === 'checkout' || v.userRole === 'Checkout'));
  
    // Define o status baseado nas verificações
    if (hasCheckoutVerification) {
      status = 'Enviado';
    } else if (hasDtfVerification) {
      status = 'DTF';
    }
  
    // Converte timestamps para datas legíveis
    const createdAtDate = data.createdAt?.toDate?.();
    const formattedCreatedAt = createdAtDate ? createdAtDate.toLocaleString("pt-BR") : "-";
  
    return {
      ...data,
      id: doc.id,
      uniqueId: doc.id,
      sequentialId: data.sequentialId || 'N/A',
      time: formattedCreatedAt,
      email: data.userEmail || "-",
      userRole: data.userRole || "-",
      shippingDate: data.shippingDate || "-",
      marketplace: data.marketplace || "-",
      status: status,
      hasCheckout: hasCheckoutVerification,
      hasDTF: hasDtfVerification
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
    if (!startDate || !endDate) {
      alert("Selecione um período para exportar os dados");
      return;
    }
  
    try {
      setLoadingHistory(true);
      const exportData = [];
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
  
      let query = db.collection("bipagens")
        .where("createdAt", ">=", startDateTime)
        .where("createdAt", "<=", endDateTime)
        .orderBy("createdAt", "desc");
  
      const processQuerySnapshot = async (snapshot) => {
        for (const doc of snapshot.docs) {
          const item = doc.data();
          
          // Busca verificações DTF e Checkout
          const verificationsSnap = await db
            .collection("bipagens")
            .doc(doc.id)
            .collection("dtf_records")
            .orderBy("timestamp", "desc")
            .get();
  
          const verifications = verificationsSnap.docs.map(vDoc => {
            const data = vDoc.data();
            return {
              timestamp: data.timestamp?.toDate().toLocaleString("pt-BR") || "-",
              userEmail: data.userEmail || "-",
              userRole: data.userRole || "-",
              status: data.status || "-",
              type: data.verificationType || "-"
            };
          });
  
          // Cria o registro base com informações principais
          const baseRecord = {
            "Sequencial": item.sequentialId || 'N/A',
            "Código": item.code || '-',
            "Data/Hora Criação": item.createdAt?.toDate().toLocaleString("pt-BR") || "-",
            "Data de Envio": item.shippingDate || "-",
            "Marketplace": item.marketplace || "-",
            "Usuário": item.userEmail || "-",
            "Função": item.userRole || "-",
            "Status": item.status || "Pendente",
            "Verificado DTF": item.dtfVerified ? "Sim" : "Não",
            "Verificado Checkout": item.checkoutVerified ? "Sim" : "Não"
          };
  
          // Se houver verificações, adiciona cada uma como uma linha
          if (verifications.length > 0) {
            verifications.forEach((v, index) => {
              exportData.push({
                ...baseRecord,
                "Nº Verificação": index + 1,
                "Data/Hora Verificação": v.timestamp,
                "Usuário Verificação": v.userEmail,
                "Tipo Verificação": v.userRole,
                "Status Verificação": v.status
              });
            });
          } else {
            // Se não houver verificações, adiciona uma linha com campos vazios
            exportData.push({
              ...baseRecord,
              "Nº Verificação": "-",
              "Data/Hora Verificação": "-",
              "Usuário Verificação": "-",
              "Tipo Verificação": "-",
              "Status Verificação": "-"
            });
          }
        }
      };
  
      // Processa em lotes
      let totalDocs = 0;
      let lastDoc = null;
      const batchSize = 500;
  
      do {
        let batchQuery = query.limit(batchSize);
        if (lastDoc) {
          batchQuery = batchQuery.startAfter(lastDoc);
        }
  
        const snapshot = await batchQuery.get();
        await processQuerySnapshot(snapshot);
        
        totalDocs += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
  
        if (totalDocs % 500 === 0) {
          console.log(`Processados ${totalDocs} registros...`);
        }
  
        if (snapshot.docs.length < batchSize) break;
      } while (lastDoc);
  
      // Configura e gera a planilha
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bipagens");
  
      // Ajusta largura das colunas
      const colWidths = [
        { wch: 10 },  // Sequencial
        { wch: 20 },  // Código
        { wch: 20 },  // Data/Hora Criação
        { wch: 15 },  // Data de Envio
        { wch: 15 },  // Marketplace
        { wch: 25 },  // Usuário
        { wch: 15 },  // Função
        { wch: 12 },  // Status
        { wch: 15 },  // Verificado DTF
        { wch: 15 },  // Verificado Checkout
        { wch: 12 },  // Nº Verificação
        { wch: 20 },  // Data/Hora Verificação
        { wch: 25 },  // Usuário Verificação
        { wch: 15 },  // Tipo Verificação
        { wch: 15 }   // Status Verificação
      ];
      ws['!cols'] = colWidths;
  
      // Nome do arquivo com período
      const fileName = `bipagens_${startDate}_a_${endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
  
      alert(`✅ Exportação concluída!\nTotal de registros: ${totalDocs}`);
    } catch (error) {
      console.error("Erro ao exportar planilha:", error);
      alert("❌ Erro ao exportar planilha: " + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Modifique a função fetchDtfRecords
const fetchDtfRecords = async (bipId) => {
  if (!auth.currentUser) return;

  try {
    // Busca o documento principal primeiro para obter a quantidade total de itens
    const bipDoc = await db.collection("bipagens").doc(bipId).get();
    const bipData = bipDoc.data();
    const totalItems = bipData.quantity || 1;

    // Busca os registros de verificação
    const records = await db
      .collection("bipagens")
      .doc(bipId)
      .collection("dtf_records")
      .orderBy("timestamp", "desc")
      .get();

    const mappedRecords = records.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate().toLocaleString("pt-BR") || "-",
        userEmail: data.userEmail || "-",
        status: data.status || "-",
        verificationType: data.verificationType || "dtf",
        userRole: data.userRole || "-",
        itemNumber: data.itemNumber || 1,
        totalItems: totalItems
      };
    });

    setDtfRecords(prev => ({
      ...prev,
      [bipId]: {
        records: mappedRecords,
        totalItems: totalItems
      }
    }));
    setExpandedRow(bipId);

  } catch (error) {
    console.error("Erro ao buscar registros:", error);
    toast.error("Erro ao buscar verificações: " + error.message);
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

  // Adicione esta função para gerenciar a ordenação
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }

    // Atualiza os itens com a nova ordenação
    const sortedItems = [...historyItems].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (field) {
        case 'createdAt':
          return direction * (new Date(a.time) - new Date(b.time));
        case 'shippingDate':
          return direction * (new Date(a.shippingDate) - new Date(b.shippingDate));
        default:
          return direction * String(a[field] || '').localeCompare(String(b[field] || ''));
      }
    });

    setHistoryItems(sortedItems);
  };

  // Modifique a lógica de filtragem
  const filteredItems = React.useMemo(() => {
    return historyItems
      .filter((item) => {
        // Filtro por código
        if (searchTerm && !item.code?.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        // Filtro de data de criação
        if (startDate && endDate) {
          const itemDate = new Date(item.time);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          if (itemDate < start || itemDate > end) return false;
        }

        // Filtro de data de envio
        if (shippingDateFilter) {
          const filterDate = new Date(shippingDateFilter).toISOString().split('T')[0];
          const itemShipDate = new Date(item.shippingDate).toISOString().split('T')[0];
          if (itemShipDate !== filterDate) return false;
        }

        // Filtro de marketplace
        if (marketplaceFilter && marketplaceFilter !== "-") {
          if (item.marketplace !== marketplaceFilter) return false;
        }

        // Filtro de loja
        if (storeFilter && storeFilter !== "-") {
          if (item.store !== storeFilter) return false;
        }

        // Filtro de status
        if (statusFilter && statusFilter !== "-") {
          if (item.status !== statusFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        
        switch (sortField) {
          case 'code':
            return direction * (a.code || '').localeCompare(b.code || '');
          case 'createdAt':
            return direction * (new Date(a.time || 0) - new Date(b.time || 0));
          case 'shippingDate':
            return direction * (new Date(a.shippingDate || 0) - new Date(b.shippingDate || 0));
          case 'marketplace':
            return direction * (a.marketplace || '').localeCompare(b.marketplace || '');
          case 'email':
            return direction * (a.email || '').localeCompare(b.email || '');
          case 'userRole':
            return direction * (a.userRole || '-').localeCompare(b.userRole || '-');
          case 'status':
            return direction * (a.status || 'Pendente').localeCompare(b.status || 'Pendente');
          case 'store':
            return direction * ((a.store || 'Não identificado')
              .localeCompare(b.store || 'Não identificado'));
          default:
            return 0;
        }
      });
  }, [historyItems, sortField, sortDirection, startDate, endDate, 
    marketplaceFilter, searchTerm, shippingDateFilter, statusFilter, storeFilter]);

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
            .limit(PAGE_SIZE);

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
            marketplace: doc.data().marketplace || "-",
            status: doc.data().status || "Pendente" // Adiciona o status
          }));

          console.log("Dados iniciais carregados:", items.length);
          setHistoryItems(items);
          
          if (snapshot.docs.length > 0) {
            setPageCursors([snapshot.docs[snapshot.docs.length - 1]]);
          }
          
          setHasNextPage(items.length === PAGE_SIZE);
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

  // Modifique a função de filtro de marketplace
  const handleMarketplaceChange = (e) => {
    const selectedMarketplace = e.target.value;
    setMarketplaceFilter(selectedMarketplace);
    
    // Reseta o filtro de loja quando mudar o marketplace
    setStoreFilter('-');
  };

  // Crie uma função para obter as lojas disponíveis
  const getAvailableStores = () => {
    if (marketplaceFilter === '-') {
      return storeOptions;
    }
    return ['-', ...(storesByMarketplace[marketplaceFilter] || [])];
  };

  // Adicione esta função para limpar os filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setMarketplaceFilter('-');
    setStoreFilter('-');
    setShippingDateFilter('');
    setStatusFilter('-');
    
    // Recarrega os dados com os filtros limpos
    loadFilteredData();
  };

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
            onClick={(e) => e.target.showPicker()}
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
            onClick={(e) => e.target.showPicker()}
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
            onChange={handleMarketplaceChange}
          >
            {marketplaceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Adicione o filtro de loja aqui */}
        <div className="history-filter-group">
          <label>Loja:</label>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
          >
            {getAvailableStores().map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filter-group">
          <label>Data de Envio:</label>
          <input
            type="date"
            value={shippingDateFilter}
            onClick={(e) => e.target.showPicker()}
            onChange={(e) => setShippingDateFilter(e.target.value)}
          />
        </div>

        <div className="history-filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filters-actions">
          <button 
            className="clear-filters-button" 
            onClick={handleClearFilters}
          >
            Limpar Filtros
          </button>
          
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
        <div className="table-header">
          <h2>Histórico de Bipagens</h2>
          <span className="records-count">
            ({filteredItems.length} {filteredItems.length === 1 ? 'registro encontrado' : 'registros encontrados'})
          </span>
        </div>
        
        {loadingHistory && (
          <div className="loading-indicator">
            <p>Buscando registros...</p>
          </div>
        )}
        <div className="table-container">
          <table className="bipagem-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('code')} className="sortable-header">
                  Código
                  {sortField === 'code' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('createdAt')} className="sortable-header">
                  Data/Horário Criação
                  {sortField === 'createdAt' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('shippingDate')} className="sortable-header">
                  Data de Envio
                  {sortField === 'shippingDate' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('marketplace')} className="sortable-header">
                  Marketplace
                  {sortField === 'marketplace' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('store')} className="sortable-header">
                  Loja
                  {sortField === 'store' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('email')} className="sortable-header">
                  Usuário
                  {sortField === 'email' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('userRole')} className="sortable-header">
                  Função
                  {sortField === 'userRole' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('status')} className="sortable-header">
                  Status
                  {sortField === 'status' && (
                    <span className={`sort-arrow ${sortDirection}`}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems && filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <React.Fragment key={item.uniqueId}>
                    <tr className={`status-${item.status?.toLowerCase()}`}>
                      <td>
                        {item.code}
                        <button
                          className={`expand-button ${expandedRow === item.id ? 'expanded' : ''}`}
                          onClick={() => handleToggleRow(item.id)}
                          aria-label="Expandir detalhes"
                        >
                          <svg 
                            viewBox="0 0 24 24" 
                            width="16" 
                            height="16" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            fill="none"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      </td>
                      <td>{item.time}</td>
                      <td>{item.shippingDate}</td>
                      <td>{item.marketplace}</td>
                      <td>{item.store || '-'}</td>
                      <td>{item.email}</td>
                      <td>{item.userRole || "-"}</td>
                      <td>
                        <span className={`status-badge ${item.status?.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {userRole === 'admin' && (
                          <button 
                            className="delete-button" 
                            onClick={() => handleDeleteHistory(item.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === item.id && (
                      <tr className="dtf-records-row">
                        <td colSpan={8}>
                          <div className="dtf-records-container">
                            <h4>
                              Verificações - Total de Itens: {dtfRecords[item.id]?.totalItems || 1}
                            </h4>
                            <table className="dtf-records-table">
                              <thead>
                                <tr>
                                  <th>Data/Hora</th>
                                  <th>Usuário</th>
                                  <th>Tipo</th>
                                  <th>Item</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dtfRecords[item.id]?.records?.length > 0 ? (
                                  dtfRecords[item.id].records.map(record => (
                                    <tr key={record.id} className={`verification-${record.verificationType}`}>
                                      <td>{record.timestamp}</td>
                                      <td>{record.userEmail}</td>
                                      <td>{record.userRole}</td>
                                      <td>
                                        Item {record.itemNumber} de {record.totalItems}
                                      </td>
                                      <td>
                                        <span className={`verification-status ${record.verificationType}`}>
                                          {record.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5}>Nenhuma verificação encontrada</td>
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
                <tr><td colSpan={8}>
                  {loadingHistory ? 'Carregando...' : 'Nenhum registro encontrado.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pagination-controls">
        <button 
          onClick={handlePrevPage}
          disabled={currentPage === 1 || loadingHistory}
          className="pagination-button"
        >
          Anterior
        </button>
        
        <span className="page-info">
          Página {currentPage}
        </span>
        
        <button 
          onClick={handleNextPage}
          disabled={!hasNextPage || loadingHistory}
          className="pagination-button"
        >
          Próxima
        </button>
      </div>
    </>
  );
};

export default HistoryPanel
