# 🔌 Integração Frontend - Upload de Imagens do Sistema

## 📋 Informações Rápidas

**Base URL:** `http://localhost:5000` (desenvolvimento) ou sua URL de produção

**Autenticação:** JWT Token no header `Authorization: Bearer {token}`

**Permissão necessária:** Perfil **S2** para upload e reset

---

## 🎯 Endpoints Disponíveis

### 1. 📤 Upload de Imagem
```
POST /system-images/upload
```

**Headers:**
- `Authorization: Bearer {token}` (obrigatório, perfil S2)
- `Content-Type: multipart/form-data` (automático)

**Body (FormData):**
- `file`: Arquivo de imagem (jpg, jpeg, png, gif, webp)
- `imageType`: `"logo"` ou `"background"`

**Resposta sucesso (200):**
```json
{
  "success": true,
  "fileName": "logo.png",
  "imagePath": "/system-images/logo.png",
  "message": "Imagem logo atualizada com sucesso"
}
```

---

### 2. 📋 Listar Imagens Atuais
```
GET /system-images/current
```

**Headers:**
- `Authorization: Bearer {token}` (qualquer usuário autenticado)

**Resposta:**
```json
{
  "logo": "/system-images/logo.png",
  "background": "/system-images/background.jpg"
}
```

Se não houver imagens customizadas:
```json
{
  "logo": null,
  "background": null,
  "message": "Nenhuma imagem personalizada configurada"
}
```

---

### 3. 🔄 Resetar para Padrão
```
DELETE /system-images/{type}
```

**Parâmetros:**
- `type`: `logo` ou `background`

**Headers:**
- `Authorization: Bearer {token}` (perfil S2)

**Exemplo:**
```
DELETE /system-images/logo
DELETE /system-images/background
```

**Resposta:**
```json
{
  "success": true,
  "message": "Imagem logo restaurada para padrão",
  "filesDeleted": 1
}
```

---

### 4. 🖼️ Exibir Imagem (Público)
```
GET /system-images/{filename}
```

**Autenticação:** NÃO necessária (público)

**Exemplo:**
```
GET /system-images/logo.png
GET /system-images/background.jpg
```

**Resposta:** Arquivo binário da imagem

---

## 💻 Código React Pronto para Usar

### Hook Personalizado

```javascript
// hooks/useSystemImages.js
import { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useSystemImages = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('token');

  // Upload de imagem
  const uploadImage = async (file, imageType) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', imageType);

      const response = await fetch(`${API_URL}/system-images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Listar imagens atuais
  const getCurrentImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/system-images/current`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar imagens');
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Resetar imagem
  const resetImage = async (type) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/system-images/${type}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao resetar imagem');
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Obter URL da imagem (para usar no src)
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return `${API_URL}${imagePath}?t=${Date.now()}`;
  };

  return {
    uploadImage,
    getCurrentImages,
    resetImage,
    getImageUrl,
    loading,
    error
  };
};
```

---

### Componente de Upload

```javascript
// components/SystemImageUploader.jsx
import React, { useState, useEffect } from 'react';
import { useSystemImages } from '../hooks/useSystemImages';

export const SystemImageUploader = () => {
  const { uploadImage, getCurrentImages, resetImage, getImageUrl, loading } = useSystemImages();
  const [images, setImages] = useState({ logo: null, background: null });
  const [selectedType, setSelectedType] = useState('logo');

  // Carregar imagens ao montar
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const result = await getCurrentImages();
      setImages(result);
    } catch (error) {
      console.error('Erro ao carregar imagens:', error);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Apenas imagens são permitidas');
      return;
    }

    try {
      await uploadImage(file, selectedType);
      alert('Imagem atualizada com sucesso!');
      await loadImages(); // Recarregar imagens
      event.target.value = ''; // Limpar input
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  const handleReset = async (type) => {
    if (!window.confirm(`Resetar ${type} para padrão?`)) return;

    try {
      await resetImage(type);
      alert('Imagem resetada com sucesso!');
      await loadImages();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  return (
    <div className="system-image-uploader">
      <h2>Configurar Imagens do Sistema</h2>

      {/* Preview das imagens atuais */}
      <div className="images-preview">
        <div className="image-box">
          <h3>Logo</h3>
          {images.logo ? (
            <>
              <img 
                src={getImageUrl(images.logo)} 
                alt="Logo" 
                style={{ maxWidth: '200px', maxHeight: '200px' }}
              />
              <button onClick={() => handleReset('logo')} disabled={loading}>
                Resetar Logo
              </button>
            </>
          ) : (
            <p>Nenhum logo customizado</p>
          )}
        </div>

        <div className="image-box">
          <h3>Background</h3>
          {images.background ? (
            <>
              <img 
                src={getImageUrl(images.background)} 
                alt="Background" 
                style={{ maxWidth: '200px', maxHeight: '200px' }}
              />
              <button onClick={() => handleReset('background')} disabled={loading}>
                Resetar Background
              </button>
            </>
          ) : (
            <p>Nenhum background customizado</p>
          )}
        </div>
      </div>

      {/* Upload */}
      <div className="upload-section">
        <h3>Upload Nova Imagem</h3>
        
        <div>
          <label>
            <input
              type="radio"
              value="logo"
              checked={selectedType === 'logo'}
              onChange={(e) => setSelectedType(e.target.value)}
            />
            Logo
          </label>
          <label>
            <input
              type="radio"
              value="background"
              checked={selectedType === 'background'}
              onChange={(e) => setSelectedType(e.target.value)}
            />
            Background
          </label>
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
        />

        {loading && <p>Processando...</p>}
      </div>
    </div>
  );
};
```

---

### Uso no Header/Navbar

```javascript
// components/Header.jsx
import React, { useState, useEffect } from 'react';
import { useSystemImages } from '../hooks/useSystemImages';

export const Header = () => {
  const { getCurrentImages, getImageUrl } = useSystemImages();
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    loadLogo();
  }, []);

  const loadLogo = async () => {
    try {
      const images = await getCurrentImages();
      if (images.logo) {
        setLogoUrl(getImageUrl(images.logo));
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  };

  return (
    <header>
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="header-logo" />
      ) : (
        <img src="/default-logo.png" alt="Logo" className="header-logo" />
      )}
      {/* Resto do header */}
    </header>
  );
};
```

---

### Uso na Tela de Login (Background)

```javascript
// pages/Login.jsx
import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const Login = () => {
  const [backgroundUrl, setBackgroundUrl] = useState(null);

  useEffect(() => {
    loadBackground();
  }, []);

  const loadBackground = async () => {
    try {
      // Endpoint público, não precisa de autenticação
      const response = await fetch(`${API_URL}/system-images/current`);
      const images = await response.json();
      
      if (images.background) {
        setBackgroundUrl(`${API_URL}${images.background}?t=${Date.now()}`);
      }
    } catch (error) {
      console.error('Erro ao carregar background:', error);
    }
  };

  return (
    <div 
      className="login-page"
      style={{
        backgroundImage: backgroundUrl 
          ? `url(${backgroundUrl})` 
          : 'url(/default-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Formulário de login */}
    </div>
  );
};
```

---

## 🎨 Estilos CSS Sugeridos

```css
/* SystemImageUploader.css */
.system-image-uploader {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.images-preview {
  display: flex;
  gap: 30px;
  margin: 30px 0;
}

.image-box {
  flex: 1;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  text-align: center;
}

.image-box img {
  border: 2px solid #ddd;
  border-radius: 4px;
  margin: 10px 0;
}

.image-box button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.image-box button:hover {
  background: #c82333;
}

.upload-section {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f8f9fa;
}

.upload-section input[type="file"] {
  display: block;
  margin: 15px 0;
  padding: 10px;
}
```

---

## ⚠️ Pontos Importantes

### 1. **Validações no Frontend**
```javascript
// Validar tamanho
if (file.size > 5 * 1024 * 1024) {
  alert('Arquivo muito grande! Máximo 5MB');
  return;
}

// Validar tipo
const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!allowedTypes.includes(file.type)) {
  alert('Tipo de arquivo não permitido');
  return;
}
```

### 2. **Cache Busting**
Adicione timestamp na URL para forçar atualização:
```javascript
const url = `${API_URL}/system-images/logo.png?t=${Date.now()}`;
```

### 3. **Tratamento de Erros**
```javascript
try {
  const result = await uploadImage(file, 'logo');
  // Sucesso
} catch (error) {
  if (error.message.includes('403')) {
    alert('Você não tem permissão para fazer isso');
  } else if (error.message.includes('401')) {
    alert('Token expirado, faça login novamente');
  } else {
    alert(`Erro: ${error.message}`);
  }
}
```

### 4. **Loading States**
Sempre mostre feedback visual durante operações:
```javascript
{loading && <div className="spinner">Carregando...</div>}
<button disabled={loading}>
  {loading ? 'Enviando...' : 'Upload'}
</button>
```

---

## 🧪 Testando a Integração

### 1. Verificar conexão com API
```javascript
fetch('http://localhost:5000/system-images/current', {
  headers: {
    'Authorization': 'Bearer SEU_TOKEN'
  }
})
  .then(res => res.json())
  .then(data => console.log('Conexão OK:', data))
  .catch(err => console.error('Erro de conexão:', err));
```

### 2. Testar CORS
Se houver erros de CORS, verifique que o backend permite sua origem no `cors` do Fastify.

---

## 📱 Casos de Uso

### Página de Configurações (S2 apenas)
- Permitir upload de logo e background
- Mostrar preview das imagens atuais
- Botões para resetar cada imagem

### Header/Navbar (todos os usuários)
- Exibir logo customizado se existir
- Fallback para logo padrão

### Tela de Login (público)
- Carregar background customizado
- Não precisa de autenticação

---

## 🔐 Controle de Acesso

```javascript
// Verificar se usuário é S2 antes de mostrar opções
const user = getUserFromToken(); // sua função

if (user.role === 'S2') {
  // Mostrar botões de upload e reset
} else {
  // Apenas visualizar
}
```

---

## 📞 Suporte

Se encontrar algum erro:
1. Verifique os logs do backend
2. Confirme que o token JWT é válido
3. Verifique que o usuário tem perfil S2
4. Teste com o arquivo HTML de teste: `/public/test-upload.html`
