# 🖼️ Endpoints de Imagens do Sistema

Esta documentação descreve os endpoints para gerenciar as imagens customizadas do sistema (logo e background).

## 📋 Endpoints Disponíveis

### 1. Upload de Imagem

**POST** `/system-images/upload`

Faz upload de uma nova imagem do sistema (logo ou background).

**Autenticação:** Requer token JWT e perfil S2

**Formato:** `multipart/form-data`

**Parâmetros:**

- `file` (arquivo): A imagem a ser enviada
- `imageType` (string): Tipo da imagem - `"logo"` ou `"background"`

**Tipos de arquivo aceitos:**

- `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Tamanho máximo: 5MB

**Resposta de sucesso:**

```json
{
  "success": true,
  "fileName": "logo.png",
  "imagePath": "/system-images/logo.png",
  "message": "Imagem logo atualizada com sucesso"
}
```

**Exemplo de uso (JavaScript/Fetch):**

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("imageType", "logo"); // ou 'background'

const response = await fetch("http://localhost:5000/system-images/upload", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
```

---

### 2. Listar Imagens Atuais

**GET** `/system-images/current`

Retorna os caminhos das imagens customizadas atualmente configuradas.

**Autenticação:** Requer token JWT

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

**Exemplo de uso:**

```javascript
const response = await fetch("http://localhost:5000/system-images/current", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const images = await response.json();
console.log("Logo:", images.logo);
console.log("Background:", images.background);
```

---

### 3. Resetar Imagem para Padrão

**DELETE** `/system-images/:type`

Remove a imagem customizada, fazendo o sistema voltar a usar a imagem padrão.

**Autenticação:** Requer token JWT e perfil S2

**Parâmetros de rota:**

- `type` (string): `"logo"` ou `"background"`

**Resposta:**

```json
{
  "success": true,
  "message": "Imagem logo restaurada para padrão",
  "filesDeleted": 1
}
```

**Exemplo de uso:**

```javascript
// Resetar logo
await fetch("http://localhost:5000/system-images/logo", {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Resetar background
await fetch("http://localhost:5000/system-images/background", {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

---

### 4. Servir Imagem do Sistema

**GET** `/system-images/:filename`

Retorna o arquivo de imagem. Este endpoint é **público** (não requer autenticação) para permitir que as imagens sejam exibidas na tela de login.

**Parâmetros de rota:**

- `filename` (string): Nome do arquivo (ex: `logo.png`, `background.jpg`)

**Resposta:** Arquivo binário da imagem

**Exemplo de uso no HTML:**

```html
<img src="http://localhost:5000/system-images/logo.png" alt="Logo" />
<div
  style="background-image: url('http://localhost:5000/system-images/background.jpg')"
></div>
```

---

## 🔐 Autenticação e Permissões

- **Upload** e **Reset**: Apenas usuários com perfil **S2** podem executar
- **Listar imagens**: Qualquer usuário autenticado
- **Servir imagem**: Público (sem autenticação necessária)

## 📁 Estrutura de Arquivos

As imagens são armazenadas em:

```
backend/
  └── public/
      └── img/
          ├── logo.png (ou .jpg, .webp, etc)
          └── background.jpg (ou .png, .webp, etc)
```

## ⚠️ Comportamento Importante

1. **Apenas um arquivo por tipo**: Ao fazer upload de um novo logo, o logo anterior é automaticamente deletado
2. **Extensões preservadas**: O sistema mantém a extensão do arquivo enviado
3. **Cache**: As imagens são cacheadas por 24 horas no navegador para melhor performance
4. **Validação de segurança**: Path traversal é bloqueado (não é possível acessar `../` ou outros diretórios)

## 🧪 Testando os Endpoints

### Usando cURL:

```bash
# Upload de logo
curl -X POST http://localhost:5000/system-images/upload \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@/caminho/para/logo.png" \
  -F "imageType=logo"

# Listar imagens atuais
curl http://localhost:5000/system-images/current \
  -H "Authorization: Bearer SEU_TOKEN"

# Resetar logo
curl -X DELETE http://localhost:5000/system-images/logo \
  -H "Authorization: Bearer SEU_TOKEN"

# Acessar imagem (público)
curl http://localhost:5000/system-images/logo.png --output logo.png
```

## 🐛 Códigos de Erro

- **400**: Requisição inválida (arquivo não enviado, tipo inválido, extensão não permitida)
- **401**: Não autenticado (token ausente ou inválido)
- **403**: Sem permissão (perfil S2 necessário)
- **404**: Imagem não encontrada
- **500**: Erro interno do servidor

## 💡 Dicas de Implementação no Frontend

### React Example:

```javascript
import { useState } from "react";

function ImageUploader() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file, type) => {
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("imageType", type);

    try {
      const response = await fetch(
        "http://localhost:5000/system-images/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        alert("Imagem atualizada com sucesso!");
        // Recarregar imagem...
      } else {
        alert("Erro: " + result.error);
      }
    } catch (error) {
      alert("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => handleUpload(e.target.files[0], "logo")}
        disabled={uploading}
      />
      {uploading && <p>Enviando...</p>}
    </div>
  );
}
```
