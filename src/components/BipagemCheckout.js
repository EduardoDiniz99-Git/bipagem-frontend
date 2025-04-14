import React, { useState, useEffect, useRef } from 'react';
import { db, auth, firebase } from '../firebase';
import { toast } from 'react-toastify';
import '../styles/BipagemCheckout.css';

const BipagemCheckout = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [bipagemData, setBipagemData] = useState(null);
  const [currentVerifications, setCurrentVerifications] = useState(0);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [scanTimeout, setScanTimeout] = useState(null);

  // Adicione esta ref no topo do componente, após os estados
  const inputRef = useRef(null);

  // Função para registrar último código escaneado
  const updateLastScannedCode = (scannedCode) => {
    setLastScannedCode(scannedCode);
    localStorage.setItem('lastScannedCheckout', scannedCode);
  };

  // Verifica a role do usuário ao montar
  useEffect(() => {
    const checkUserRole = async () => {
      if (!auth.currentUser) {
        toast.error('Usuário não autenticado');
        return;
      }

      try {
        const userDoc = await db
          .collection('users')
          .doc(auth.currentUser.uid)
          .get();

        if (!userDoc.exists) {
          toast.error('Perfil de usuário não encontrado');
          return;
        }

        const role = userDoc.data().role;
        setUserRole(role);

        if (role !== 'admin' && role !== 'Checkout') {
          toast.error('Você não tem permissão para acessar esta área');
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        toast.error('Erro ao verificar permissões');
      }
    };

    checkUserRole();
  }, []);

  // Adicione este useEffect para garantir o foco
  useEffect(() => {
    // Foca o input ao montar o componente
    inputRef.current?.focus();
    
    // Adiciona listener para manter o foco
    const handleKeyUp = (e) => {
      if (e.key === 'Enter') {
        // Pequeno delay para garantir que o foco seja mantido após o submit
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Adicione este useEffect logo após os outros useEffects
  useEffect(() => {
    // Função para manter o foco no input
    const keepFocus = () => {
      if (inputRef.current && bipagemData && currentVerifications < bipagemData.quantity) {
        inputRef.current.focus();
      }
    };

    // Chama a função quando currentVerifications mudar
    keepFocus();

    // Adiciona listener para tecla Enter
    const handleKeyUp = (e) => {
      if (e.key === 'Enter') {
        keepFocus();
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentVerifications, bipagemData]);

  // Adicione este useEffect após os outros
  useEffect(() => {
    const focusInput = () => {
      if (
        inputRef.current && 
        !loading && 
        bipagemData?.quantity > currentVerifications
      ) {
        inputRef.current.focus();
      }
    };

    focusInput();

    // Adiciona listeners para eventos comuns que podem tirar o foco
    const events = ['mousedown', 'mouseup', 'touchend', 'keyup'];
    
    const handleEvent = (e) => {
      // Se o evento for keyup, só refoca se for Enter
      if (e.type === 'keyup' && e.key !== 'Enter') return;
      
      // Pequeno delay para garantir que outros handlers terminaram
      setTimeout(focusInput, 0);
    };

    events.forEach(event => {
      document.addEventListener(event, handleEvent);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleEvent);
      });
    };
  }, [loading, currentVerifications, bipagemData]);

  // Modifique o handleSubmit para manter o foco
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!code.trim()) return;
    
    setLoading(true);
    const trimmedCode = code.trim();

    try {
      // Validações iniciais em um bloco try/catch separado
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }

      if (userRole !== 'admin' && userRole !== 'Checkout') {
        throw new Error('Sem permissão para esta ação');
      }

      // Busca e validação do código
      const bipagemSnapshot = await db.collection('bipagens')
        .where('code', '==', trimmedCode)
        .limit(1) // Otimização: limita a busca a 1 documento
        .get();

      if (bipagemSnapshot.empty) {
        throw new Error('Código não encontrado');
      }

      // Processamento do documento encontrado
      const bipagemDoc = bipagemSnapshot.docs[0];
      const data = bipagemDoc.data();
      
      // Atualiza último código escaneado
      updateLastScannedCode(trimmedCode);

      setBipagemData(data);
      const totalItems = data.quantity || 1;

      // Modifique a consulta das verificações existentes
      const checkoutRecordsSnapshot = await bipagemDoc.ref
        .collection('dtf_records')
        .where('verificationType', '==', 'checkout')
        .get();

      // Ordene os resultados após obtê-los
      const existingVerifications = checkoutRecordsSnapshot.docs
        .map(doc => doc.data())
        .sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());
      
      // Verifica se já atingiu o limite de itens
      if (existingVerifications.length >= totalItems) {
        throw new Error(`Todos os ${totalItems} itens já foram verificados`);
      }

      // Determina qual é o próximo item a ser verificado
      const nextItemNumber = existingVerifications.length + 1;

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(bipagemDoc.ref);
        
        if (!doc.exists) {
          throw new Error('Documento não encontrado');
        }

        // Cria novo registro na coleção dtf_records
        const newRecordRef = bipagemDoc.ref.collection('dtf_records').doc();
        
        transaction.set(newRecordRef, {
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          userRole: 'Checkout',
          timestamp: new Date(),
          status: 'Verificado Checkout',
          verificationType: 'checkout',
          itemNumber: nextItemNumber, // Usa o número correto do item
          totalItems: totalItems,
          details: {
            checkoutTimestamp: new Date(),
            checkoutUserEmail: auth.currentUser.email,
            checkoutUserId: auth.currentUser.uid
          }
        });

        // Modifique o trecho dentro do runTransaction
        if (nextItemNumber === totalItems) {
          transaction.update(bipagemDoc.ref, {
            checkoutVerified: true,
            lastUpdated: new Date(),
            status: 'Enviado',
            verifications: firebase.firestore.FieldValue.arrayUnion({
              type: 'checkout',
              timestamp: new Date(),
              userEmail: auth.currentUser.email,
              status: 'Enviado'
            })
          });
          
          toast.success('Todos os itens foram verificados! Status atualizado para Enviado.');
          
          // Limpa todos os dados apenas quando finalizar
          setBipagemData(null);
          setCurrentVerifications(0);
          setVerifiedItems([]);
          setCode('');
          
          // Adicione estas linhas para habilitar o input após finalizar
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.disabled = false;
              inputRef.current.focus();
            }
          }, 100);
          
        } else {
          // Para itens intermediários
          const remaining = totalItems - nextItemNumber;
          toast.info(`Item ${nextItemNumber} verificado! Faltam ${remaining} ${remaining === 1 ? 'item' : 'itens'} para verificar.`);
          
          // Atualiza a contagem
          setCurrentVerifications(nextItemNumber);
          
          // Limpa o código e força o foco imediatamente
          setCode('');
          
          // Usa setTimeout para garantir que o estado foi atualizado
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.disabled = false;
              inputRef.current.focus();
            }
          }, 0);
        }
      });

      // Atualiza os estados
      setCurrentVerifications(nextItemNumber);
      setCode('');
      // Mantém o foco no input
      inputRef.current?.focus();

      // Feedback sonoro de sucesso
      new Audio('/success-beep.mp3').play().catch(() => {});

    } catch (error) {
      console.error('Erro ao verificar código:', error);
      toast.error(`Erro: ${error.message}`);
      setBipagemData(null);
      setCurrentVerifications(0);
      // Mesmo em caso de erro, mantém o foco
      inputRef.current?.focus();

      // Feedback sonoro de erro
      new Audio('/error-beep.mp3').play().catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const clearInputAfterDelay = () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    const timeout = setTimeout(() => {
      setCode('');
    }, 3000); // 3 segundos
    setScanTimeout(timeout);
  };

  // Otimize o handleInputChange
  const handleInputChange = (e) => {
    const value = e.target.value.trim();
    setCode(value);

    // Cancela timeout anterior
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      setScanTimeout(null);
    }

    // Submete automaticamente se atingir tamanho mínimo
    if (value.length >= 10) {
      handleSubmit(new Event('submit'));
    }
  };

  // Adicione o handler para tecla Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && code.trim()) {
      e.preventDefault();
      handleSubmit(new Event('submit'));
    }
  };

  return (
    <div className="bipagem-checkout-container">
      <header className="checkout-header">
        <h2>Verificação de Checkout</h2>
        {bipagemData && (
          <div className="current-item-info">
            <span>Marketplace: {bipagemData.marketplace}</span>
            <span>Data Envio: {bipagemData.shippingDate}</span>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="input-group">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={loading ? "Processando..." : ""}
              disabled={loading}
              autoFocus
              aria-label="Campo para digitar ou escanear código"
              className={`scan-input ${loading ? 'input-disabled' : ''} ${bipagemData ? 'scan-success' : ''}`}
            />
            {lastScannedCode && (
              <div className="last-scanned">
                <span className="last-scanned-label">Último código escaneado:</span>
                <span className="last-scanned-value">{lastScannedCode}</span>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Barra de Progresso melhorada */}
      {bipagemData?.quantity > 1 && (
        <div className="verification-progress">
          <div className="progress-header">
            <span className="progress-title">Progresso da Verificação</span>
            <span className="progress-count">
              {currentVerifications} de {bipagemData.quantity} itens
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(currentVerifications / bipagemData.quantity) * 100}%`,
                backgroundColor: currentVerifications === bipagemData.quantity ? '#10b981' : '#4f46e5'
              }}
            />
          </div>
        </div>
      )}

      {userRole && userRole !== 'admin' && userRole !== 'Checkout' && (
        <div className="status-indicator status-error">
          Você não tem permissão para realizar verificações de Checkout
        </div>
      )}

      {loading && (
        <div className="status-indicator">
          Processando verificação...
        </div>
      )}
    </div>
  );
};

export default BipagemCheckout;
