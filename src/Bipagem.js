// src/Bipagem.js
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { useLocation } from 'react-router-dom';
import BipagemPanel from "./components/BipagemPanel";
import HistoryPanel from "./components/HistoryPanel";
import DashboardPanel from "./components/DashboardPanel";
import Usuarios from "./components/Usuarios";
import BipagemDTF from './components/BipagemDTF';
import BipagemCheckout from './components/BipagemCheckout';
import "./Bipagem.css";

const Bipagem = () => {
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState(
    location.state?.activeMenu || "bipagem"
  );
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({ name: "", role: "" });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (!showProfile) return;
    setLoadingProfile(true);
    const uid = auth.currentUser?.uid;
    if (uid) {
      db.collection("users")
        .doc(uid)
        .get()
        .then((doc) => {
          const d = doc.exists ? doc.data() : {};
          setProfile({
            name: d.name || auth.currentUser.displayName || "",
            role: d.role || "",
          });
        })
        .catch(console.error)
        .finally(() => setLoadingProfile(false));
    } else {
      setLoadingProfile(false);
    }
  }, [showProfile]);

  // Add effect to fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const userDoc = await db
          .collection("users")
          .doc(auth.currentUser.uid)
          .get();
        
        if (userDoc.exists) {
          setUserRole(userDoc.data().role || "");
        }
      } catch (err) {
        console.error("Erro ao buscar função do usuário:", err);
      }
    };

    fetchUserRole();
  }, []);

  // Function to check if user has access to specific panel
  const hasAccess = (panelType) => {
    switch (panelType) {
      case "dtf":
        return userRole === "DTF" || userRole === "admin";
      case "checkout":
        return userRole === "Checkout" || userRole === "admin";
      default:
        return true;
    }
  };

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="account-info">
            <span>{auth.currentUser?.email}</span>
            <button
              className="settings-button"
              onClick={() => setShowProfile(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.14,12.94a7.48,7.48,0,0,0,0-1.88l2.11-1.65a.5.5,0,0,0,.12-.65l-2-3.46a.5.5,0,0,0-.61-.22l-2.49,1a7.28,7.28,0,0,0-1.62-.94l-.38-2.65A.5.5,0,0,0,14,3H10a.5.5,0,0,0-.49.42L9.13,6.07a7.28,7.28,0,0,0-1.62.94l-2.49-1a.5.5,0,0,0-.61.22l-2,3.46a.5.5,0,0,0,.12.65l2.11,1.65a7.48,7.48,0,0,0,0,1.88L2.63,14.59a.5.5,0,0,0-.12.65l2,3.46a.5.5,0,0,0,.61.22l2.49-1a7.28,7.28,0,0,0,1.62.94l.38,2.65A.5.5,0,0,0,10,21h4a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.62-.94l2.49,1a.5.5,0,0,0,.61-.22l2-3.46a.5.5,0,0,0-.12-.65ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
              </svg>
            </button>
          </div>
          <button className="logout-button" onClick={() => auth.signOut()}>
            Sair
          </button>
        </div>
        <nav className="menu">
          <ul>
            <li
              className={activeMenu === "dashboard" ? "active" : ""}
              onClick={() => setActiveMenu("dashboard")}
            >
              Painel
            </li>
            <li
              className={activeMenu === "bipagem" ? "active" : ""}
              onClick={() => setActiveMenu("bipagem")}
            >
              Bipagem
            </li>
            {userRole === "DTF" || userRole === "admin" ? (
              <li
                className={activeMenu === "bipagem-dtf" ? "active" : ""}
                onClick={() => setActiveMenu("bipagem-dtf")}
              >
                Bipagem DTF
              </li>
            ) : null}
            {hasAccess("checkout") && (
              <li
                className={activeMenu === "bipagem-checkout" ? "active" : ""}
                onClick={() => setActiveMenu("bipagem-checkout")}
              >
                Bipagem Checkout
              </li>
            )}
            <li
              className={activeMenu === "history" ? "active" : ""}
              onClick={() => setActiveMenu("history")}
            >
              Consultar Bipagens
            </li>
            <li
              className={activeMenu === "usuarios" ? "active" : ""}
              onClick={() => setActiveMenu("usuarios")}
            >
              Usuários
            </li>
          </ul>
        </nav>
      </aside>

      <div className="bipagem-wrapper">
        <main className="bipagem-main">
          {activeMenu === "dashboard" && <DashboardPanel setActiveMenu={setActiveMenu} />}
          {activeMenu === "bipagem" && <BipagemPanel panelType="Geral" setActiveMenu={setActiveMenu} />}
          {activeMenu === "bipagem-dtf" && <BipagemDTF />}
          {activeMenu === "bipagem-checkout" && <BipagemCheckout />}
          {activeMenu === "history" && <HistoryPanel autoLoad={true} />}
          {activeMenu === "usuarios" && <Usuarios />}
        </main>
      </div>

      {showProfile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              className="close-button"
              onClick={() => setShowProfile(false)}
            >
              &times;
            </button>
            <h2>Dados do Perfil</h2>
            {loadingProfile ? (
              <p>Carregando...</p>
            ) : (
              <div className="profile-details">
                <p>
                  <strong>Nome:</strong> {profile.name || "-"}
                </p>
                <p>
                  <strong>E-mail:</strong> {auth.currentUser?.email}
                </p>
                <p>
                  <strong>Função:</strong> {profile.role || "-"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Bipagem;
