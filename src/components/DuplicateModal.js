import React from 'react';
import './DuplicateModal.css';

const DuplicateModal = ({ duplicates, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Códigos Duplicados Encontrados</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="duplicate-list">
          {duplicates.map((code, index) => (
            <div key={index} className="duplicate-item">
              <span className="duplicate-code">{code}</span>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateModal;