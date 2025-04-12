import React, { useState, useEffect } from 'react';import { useNavigate } from 'react-router-dom';import { auth, db } from '../firebase';import BipagemPanel from '../components/BipagemPanel';import '../styles/BipagemPage.css';const BipagemPage = () => {  const navigate = useNavigate();  const [userRole, setUserRole] = useState("");  const [showProfile, setShowProfile] = useState(false);  useEffect(() => {    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          setUserRole(doc.data().role);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <div className="logo-container">
          <img src="/logo.png" alt="Logo" className="logo" />
        </div>

        <nav className="menu">
          <ul>
            <li onClick={() => navigate('/')}>
              Dashboard
            </li>
            <li className="active">
              Bipar Pedidos
            </li>
            <li onClick={() => navigate('/consultar-bipagens')}>
              Consultar Bipagens
            </li>
            <li onClick={() => navigate('/dtf')}>
              DTF
            </li>
            <li onClick={() => navigate('/checkout')}>
              Checkout
            </li>
            {userRole === 'admin' && (
              <li onClick={() => navigate('/usuarios')}>
                Usuários
              </li>
            )}
          </ul>
        </nav>

        <div className="user-section">
          <div className="user-info">
            <span>{auth.currentUser?.email}</span>
            <span className="user-role">{userRole}</span>
          </div>
          <button 
            className="logout-button"
            onClick={() => auth.signOut().then(() => navigate('/login'))}
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          <BipagemPanel panelType="Geral" />
        </div>
      </main>
    </div>
  );
};

export default BipagemPage;