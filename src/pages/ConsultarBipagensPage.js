import React, { useEffect } from 'react';import { useLocation } from 'react-router-dom';import HistoryPanel from '../components/HistoryPanel';import MenuLayout from '../layouts/MenuLayout';const ConsultarBipagensPage = () => {  const location = useLocation();  return (    <MenuLayout activeMenu="history">      <HistoryPanel         autoLoad={true}        initialFilters={location.state?.applyFilters ? {
          startDate: location.state.startDate,
          endDate: location.state.endDate,
          marketplaceFilter: location.state.marketplaceFilter
        } : null}
      />
    </MenuLayout>
  );
};

export default ConsultarBipagensPage;