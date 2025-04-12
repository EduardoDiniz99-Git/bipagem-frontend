// src/components/DashboardPanel.js
import React, { useState, useEffect } from "react";
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

  // Adicione no início do componente, após os estados
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 segundos

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

    // Configurar atualização automática
    const interval = setInterval(() => {
      fetchBipsDeHoje();
      fetchAmanhaShipping();
      fetchMarketplaceCounts();
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
        if (counts[data.marketplace]) {
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
    'Amazon', 
    'Netshoes', 
    'Mercado Livre',
    'Shopee',
    'Shein',
    'Magalu'
  ];

  // Adicione antes do return
  const handleRefreshNow = () => {
    fetchBipsDeHoje();
    fetchAmanhaShipping();
    fetchMarketplaceCounts();
  };

  const handleCardClick = (type, marketplace = null) => {
    // Ativa o menu de histórico
    setActiveMenu("history");

    const today = formatDate(new Date());
    const tomorrow = formatDate(new Date(Date.now() + 86400000));

    // Define os filtros baseado no tipo do card
    let filters = {};
    
    switch(type) {
      case 'today':
        filters = {
          startDate: today,
          endDate: today,
          marketplaceFilter: '-'
        };
        break;
      
      case 'tomorrow':
        filters = {
          startDate: tomorrow,
          endDate: tomorrow,
          marketplaceFilter: '-'
        };
        break;
      
      case 'marketplace':
        filters = {
          startDate: today,
          endDate: today,
          marketplaceFilter: marketplace
        };
        break;
    }

    // Navega e passa os filtros via state
    navigate('/', { 
      state: { 
        activeMenu: 'history',
        filters 
      }
    });
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
      </div>

      {/* Container com scroll horizontal para o grid de marketplaces */}
      <div className="marketplace-grid-container">
        <div className="marketplace-grid">
          {marketplaceOrder.map(marketplace => (
            <div 
              key={marketplace} 
              className="marketplace-card clickable"
              onClick={() => handleCardClick('marketplace', marketplace)}
            >
              <div className="marketplace-logo">
                <img src={marketplaceLogos[marketplace]} alt={`Logo ${marketplace}`} />
              </div>
              <div className="marketplace-info">
                <h3>{marketplace}</h3>
                <span className="marketplace-count">{marketplaceCounts[marketplace]}</span>
                <span className="marketplace-label">pedidos hoje</span>
              </div>
            </div>
          ))}
        </div>
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
