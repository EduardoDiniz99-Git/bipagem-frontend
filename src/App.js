// src/App.js
import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import Login from "./Login";
import Bipagem from "./Bipagem";
import "./App.css";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Monitora o estado de autenticação
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Bipagem /> : <Login />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;
