import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { toast } from 'react-toastify';

const BipagemCheckout = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.warn('Digite um código para verificar');
      return;
    }

    setLoading(true);
    try {
      // Busca o registro da bipagem
      const bipagemSnapshot = await db
        .collection('bipagens')
        .where('code', '==', code.trim())
        .get();

      if (bipagemSnapshot.empty) {
        toast.error('Código não encontrado');
        return;
      }

      const bipagemDoc = bipagemSnapshot.docs[0];
      const bipagem = bipagemDoc.data();

      // Verifica se já foi verificado pelo Checkout
      const checkoutRecords = await bipagemDoc.ref
        .collection('checkout_records')
        .where('status', '==', 'Verificado Checkout')
        .get();

      if (!checkoutRecords.empty) {
        toast.warn('Este código já foi verificado pelo Checkout');
        return;
      }

      // Adiciona o registro de verificação do Checkout
      await bipagemDoc.ref.collection('checkout_records').add({
        userEmail: auth.currentUser.email,
        timestamp: new Date(),
        status: 'Verificado Checkout'
      });

      // Atualiza o status no documento principal
      await bipagemDoc.ref.update({
        checkoutVerified: true,
        checkoutTimestamp: new Date(),
        checkoutUserEmail: auth.currentUser.email
      });

      toast.success('Verificação do Checkout registrada com sucesso!');
      setCode(''); // Limpa o campo após sucesso

    } catch (error) {
      console.error('Erro ao verificar código:', error);
      toast.error('Erro ao verificar código: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bipagem-checkout-container">
      <h2>Verificação de Checkout</h2>
      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="input-group">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Digite o código para verificar"
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BipagemCheckout;
