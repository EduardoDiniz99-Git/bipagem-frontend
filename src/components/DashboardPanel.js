// src/components/DashboardPanel.js
import React, { useState, useEffect } from "react";
import "../styles/DashboardPanel.css";
import firebase, { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from 'react-router-dom';

const DashboardPanel = ({ setActiveMenu }) => {
  const navigate = useNavigate();

  // Adicione estas funções utilitárias no início do componente
  const getFirstDayOfMonth = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getLastDayOfMonth = () => {
    const date = new Date();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  };

  // Função utilitária para formatar data como "YYYY-MM-DD"
  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateDisplay = (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  // Adicione esta função utilitária para calcular data de 15 dias atrás
  const getDateFrom15DaysAgo = () => {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    return formatDate(date);
  };

  // Data atual com hora zerada
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Data inicial padrão: 7 dias antes de hoje
  const defaultStartDate = formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  // Data final padrão: amanhã (hoje + 1 dia)
  const defaultEndDate = formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000));

  // Estados para o período do gráfico (baseado em shippingDate)
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [totalCount, setTotalCount] = useState(null);
  const [dailyCounts, setDailyCounts] = useState([]);

  // Contadores rápidos (baseados em shippingDate)
  const [todayCount, setTodayCount] = useState(0);
  const [tomorrowShippingCount, setTomorrowShippingCount] = useState(0);

  // Adicione após os outros estados
  const [marketplaceCounts, setMarketplaceCounts] = useState({
    'Mercado Livre': 0,
    'Shopee': 0,
    'Shein': 0,
    'Amazon': 0,
    'Netshoes': 0,
    'Magalu': 0
  });

  // Adicione após os outros estados
  const [sentOrdersCount, setSentOrdersCount] = useState(0);

  // Adicione junto aos outros estados
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Adicione após o objeto marketplaceCounts
  const [storeCounts, setStoreCounts] = useState({});

  // Adicione no início do componente, após os estados
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 segundos

  // Adicione este estado após os outros estados
  const [openDropdown, setOpenDropdown] = useState(null);

  // Adicione após a definição de marketplaceOrder
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

  // Busca assim que o painel carrega
  useEffect(() => {
    fetchBipsDeHoje();
    fetchAmanhaShipping();
  }, []);

  // Adicione após os outros useEffect
  useEffect(() => {
    fetchMarketplaceCounts();
  }, []);

  // Adicione após os outros useEffect
  useEffect(() => {
    // Atualização inicial
    fetchBipsDeHoje();
    fetchAmanhaShipping();
    fetchMarketplaceCounts();
    fetchSentOrders(); // Adicione esta linha
    fetchPendingOrders(); // Adicione esta linha
    fetchStoreCounts(); // Adicione esta linha
    fetchLateOrders(); // Adicione esta linha

    // Configurar atualização automática
    const interval = setInterval(() => {
      fetchBipsDeHoje();
      fetchAmanhaShipping();
      fetchMarketplaceCounts();
      fetchSentOrders(); // Adicione esta linha
      fetchPendingOrders(); // Adicione esta linha
      fetchStoreCounts(); // Adicione esta linha
      fetchLateOrders(); // Adicione esta linha
    }, refreshInterval);

    // Limpar intervalo quando o componente for desmontado
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // ==========================
  // 1) Bips de HOJE (ShippingDate)
  // ==========================
  const fetchBipsDeHoje = async () => {
    try {
      const todayStr = formatDate(new Date());
      // Consulta os documentos com shippingDate igual à data de hoje
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", todayStr)
        .get();

      // Filtra códigos únicos
      const uniqueCodes = new Set();
      snap.docs.forEach(doc => {
        uniqueCodes.add(doc.data().code);
      });

      setTodayCount(uniqueCodes.size);
    } catch (err) {
      console.error("Erro ao buscar bips de hoje:", err);
    }
  };

  // ==========================
  // 2) Pedidos para Enviar AMANHÃ (ShippingDate)
  // ==========================
  const fetchAmanhaShipping = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);
      
      // Consulta os documentos com shippingDate igual à data de amanhã
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", tomorrowStr)
        .get();

      // Filtra códigos únicos
      const uniqueCodes = new Set();
      snap.docs.forEach(doc => {
        uniqueCodes.add(doc.data().code);
      });

      setTomorrowShippingCount(uniqueCodes.size);
    } catch (err) {
      console.error("Erro ao buscar pedidos de amanhã:", err);
    }
  };

  // Adicione após as outras funções
  const fetchMarketplaceCounts = async () => {
    try {
      const todayStr = formatDate(new Date());
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", todayStr)
        .get();

      const counts = {
        'Mercado Livre': new Set(),
        'Shopee': new Set(),
        'Shein': new Set(),
        'Amazon': new Set(),
        'Netshoes': new Set(),
        'Magalu': new Set()
      };

      snap.docs.forEach(doc => {
        const data = doc.data();
        // Verifica se o status é Pendente ou não existe
        if ((!data.status || data.status === 'Pendente' || data.status === '') && counts[data.marketplace]) {
          counts[data.marketplace].add(data.code);
        }
      });

      // Converte Sets para contagens
      const marketplaceTotals = Object.keys(counts).reduce((acc, key) => {
        acc[key] = counts[key].size;
        return acc;
      }, {});

      setMarketplaceCounts(marketplaceTotals);
    } catch (err) {
      console.error("Erro ao buscar contagens por marketplace:", err);
    }
  };

  // Adicione após as outras funções de fetch
  const fetchSentOrders = async () => {
    try {
      const todayStr = formatDate(new Date());
      
      // Busca pedidos com status 'Enviado' de hoje
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", todayStr)
        .where("status", "==", "Enviado")
        .get();

      // Filtra códigos únicos
      const uniqueCodes = new Set();
      snap.docs.forEach(doc => {
        uniqueCodes.add(doc.data().code);
      });

      setSentOrdersCount(uniqueCodes.size);
    } catch (err) {
      console.error("Erro ao buscar pedidos enviados:", err);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const todayStr = formatDate(new Date());
      
      // Busca todos os pedidos de hoje sem filtrar por status inicialmente
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", todayStr)
        .get();

      // Filtra códigos únicos que estão pendentes (não tem status ou status é Pendente)
      const uniqueCodes = new Set();
      snap.docs.forEach(doc => {
        const data = doc.data();
        // Considera como pendente se não tiver status ou se o status for Pendente
        if (!data.status || data.status === 'Pendente' || data.status === '') {
          uniqueCodes.add(data.code);
        }
      });

      setPendingOrdersCount(uniqueCodes.size);
    } catch (err) {
      console.error("Erro ao buscar pedidos pendentes:", err);
    }
  };

  // Modifique a função fetchStoreCounts
  const fetchStoreCounts = async () => {
    try {
      const todayStr = formatDate(new Date());
      const snap = await db.collection("bipagens")
        .where("shippingDate", "==", todayStr)
        .get();

      const counts = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.status || data.status === 'Pendente' || data.status === '') {
          const store = data.store || 'Não identificado';
          const marketplace = data.marketplace || 'Não identificado';
          const storeKey = `${store}_${marketplace}`; // Chave única combinando loja e marketplace

          if (!counts[storeKey]) {
            counts[storeKey] = {
              store,
              marketplace,
              codes: new Set()
            };
          }
          counts[storeKey].codes.add(data.code);
        }
      });

      // Converte para o formato final
      const storeTotals = Object.values(counts).reduce((acc, { store, marketplace, codes }) => {
        acc[store] = {
          count: codes.size,
          marketplace
        };
        return acc;
      }, {});

      setStoreCounts(storeTotals);
    } catch (err) {
      console.error("Erro ao buscar contagens por loja:", err);
    }
  };

  // Adicione o novo estado
  const [lateOrdersCount, setLateOrdersCount] = useState(0);

  // Adicione a nova função para buscar pedidos atrasados
  const fetchLateOrders = async () => {
    try {
      const today = formatDate(new Date());
      const snap = await db.collection("bipagens")
        .where("shippingDate", "<", today)
        .get();

      // Filtra códigos únicos que ainda estão pendentes
      const uniqueCodes = new Set();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.status || data.status === 'Pendente' || data.status === '') {
          uniqueCodes.add(data.code);
        }
      });

      setLateOrdersCount(uniqueCodes.size);
    } catch (err) {
      console.error("Erro ao buscar pedidos atrasados:", err);
    }
  };

  // ========================================
  // Lógica do GRÁFICO (Pesquisa por período custom)
  // Usamos shippingDate para filtrar os registros
  // ========================================
  const handleFetch = async () => {
    if (!startDate || !endDate) {
      alert("Selecione data inicial e final.");
      return;
    }

    try {
      // Como shippingDate é armazenado como string "YYYY-MM-DD",
      // podemos comparar diretamente, pois esse formato ordena de forma natural.
      const snap = await db
        .collection("bipagens")
        .where("shippingDate", ">=", startDate)
        .where("shippingDate", "<=", endDate)
        .get();
      
      const docs = snap.docs;
      setTotalCount(docs.length);

      // Agrupa os registros por shippingDate
      const counts = {};
      docs.forEach((doc) => {
        const d = doc.data();
        if (d.shippingDate) {
          const day = d.shippingDate;
          counts[day] = (counts[day] || 0) + 1;
        }
      });

      // Cria array ordenado (ordenação natural de strings YYYY-MM-DD)
      const chartData = Object.keys(counts)
        .sort()
        .map((day) => ({ date: day, count: counts[day] }));

      setDailyCounts(chartData);
    } catch (err) {
      console.error("Erro ao buscar dados do painel:", err);
      alert("Erro ao buscar dados: " + err.message);
    }
  };

  const marketplaceLogos = {
    'Mercado Livre': '/logos/mercadolivre.png',
    'Shopee': '/logos/shopee.png',
    'Shein': '/logos/shein.png',
    'Amazon': '/logos/amazon.png',
    'Netshoes': '/logos/netshoes.png',
    'Magalu': '/logos/magalu.png'
  };

  // Ordem específica dos marketplaces
  const marketplaceOrder = [
    'Shopee',
    'Mercado Livre',
    'Shein',
    'Netshoes', 
    'Magalu',
    'Amazon'
  ];

  // Adicione antes do return
  const handleRefreshNow = () => {
    fetchBipsDeHoje();
    fetchAmanhaShipping();
    fetchMarketplaceCounts();
  };

  const handleCardClick = (type, marketplace = null, store = null) => {
    const today = formatDate(new Date()); // Formato YYYY-MM-DD
  
    let filters = {
      marketplaceFilter: '-',
      statusFilter: '-',
      storeFilter: '-',
      shippingDateFilter: '',
      startDate: '',
      endDate: '',
      title: ''
    };
  
    switch(type) {
      case 'sent':
        filters = {
          ...filters,
          statusFilter: 'Enviado',
          shippingDateFilter: today,
          title: 'Pedidos Embalados Hoje'
        };
        break;
  
      case 'pending':
        filters = {
          ...filters,
          statusFilter: 'Pendente',
          shippingDateFilter: today,
          title: 'Pedidos a Enviar Hoje'
        };
        break;
  
      case 'marketplace':
        filters = {
          ...filters,
          marketplaceFilter: marketplace,
          statusFilter: 'Pendente',
          shippingDateFilter: today,
          title: `Pedidos ${marketplace} Hoje`
        };
        break;
  
      case 'store':
        filters = {
          ...filters,
          marketplaceFilter: marketplace,
          storeFilter: store,
          statusFilter: 'Pendente',
          shippingDateFilter: today,
          title: `Pedidos ${store} Hoje`
        };
        break;
  
      case 'late':
        filters = {
          ...filters,
          statusFilter: 'Atrasado',
          endDate: today,
          title: 'Pedidos Atrasados'
        };
        break;

      case 'tomorrow':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDate(tomorrow);
        
        filters = {
          ...filters,
          statusFilter: 'Pendente',
          shippingDateFilter: tomorrowStr, // Data de amanhã no formato YYYY-MM-DD
          title: 'Pedidos para Amanhã'
        };
        break;
  
      // Mantém os outros cases existentes...
    }
  
    // Atualiza o menu e salva os filtros
    setActiveMenu("history");
    localStorage.setItem('lastHistoryFilters', JSON.stringify(filters));
    
    // Força atualização da página com os novos filtros
    window.location.href = '/?menu=history';
  };
  
  return (
    <div className="dashboard-container">
      <div className="top-stats-container">
        <div 
          className="top-stat-card clickable"
          onClick={() => handleCardClick('today')}
        >
          <span className="top-stat-date">{formatDateDisplay(new Date())}</span>
          <span className="top-stat-value">{todayCount}</span>
          <span className="top-stat-label">Pedidos Hoje</span>
        </div>
        
        <div 
          className="top-stat-card clickable"
          onClick={() => handleCardClick('tomorrow')}
        >
          <span className="top-stat-date">
            {formatDateDisplay(new Date(Date.now() + 86400000))}
          </span>
          <span className="top-stat-value">{tomorrowShippingCount}</span>
          <span className="top-stat-label">Pedidos para Amanhã</span>
        </div>
        
        <div 
          className="top-stat-card clickable sent-orders"
          onClick={() => handleCardClick('sent')}
        >
          <span className="top-stat-date">{formatDateDisplay(new Date())}</span>
          <span className="top-stat-value">{sentOrdersCount}</span>
          <span className="top-stat-label">Pedidos Embalados</span>
        </div>

        <div 
          className="top-stat-card clickable pending-orders"
          onClick={() => handleCardClick('pending')}
        >
          <span className="top-stat-date">{formatDateDisplay(new Date())}</span>
          <span className="top-stat-value">{pendingOrdersCount}</span>
          <span className="top-stat-label">Pedidos a Enviar</span>
        </div>

        <div 
          className="top-stat-card clickable late-orders"
          onClick={() => handleCardClick('late')}
        >
          <span className="top-stat-date">{formatDateDisplay(new Date())}</span>
          <span className="top-stat-value">{lateOrdersCount}</span>
          <span className="top-stat-label">Pedidos Atrasados</span>
        </div>
      </div>

      {/* Container com scroll horizontal para o grid de marketplaces */}
      <div className="marketplace-section">
        {marketplaceOrder.map(marketplace => (
          <div key={marketplace} className="marketplace-block">
            <div 
              className="marketplace-card clickable"
              onClick={() => handleCardClick('marketplace', marketplace)}
            >
              <div className="marketplace-logo">
                <img src={marketplaceLogos[marketplace]} alt={`Logo ${marketplace}`} />
              </div>
              <div className="marketplace-info">
                <h3>{marketplace}</h3>
                <span className="marketplace-count">{marketplaceCounts[marketplace]}</span>
                <span className="marketplace-label">pendentes hoje</span>
              </div>
            </div>

            <div className="stores-grid">
              {storesByMarketplace[marketplace].map(store => (
                <div 
                  key={`${store}_${marketplace}`}
                  className="store-card clickable"
                  onClick={() => handleCardClick('store', marketplace, store)}
                >
                  <div className="store-info">
                    <h4>{store}</h4>
                    <span className="store-count">
                      {storeCounts[store]?.marketplace === marketplace ? storeCounts[store]?.count || 0 : 0}
                    </span>
                    <span className="store-label">pendentes hoje</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalCount !== null && (
        <div className="dashboard-summary">
          <p>
            Total de bips (no período pesquisado): <strong>{totalCount}</strong>
          </p>
        </div>
      )}

      {dailyCounts.length > 0 && (
        <div className="dashboard-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardPanel;
