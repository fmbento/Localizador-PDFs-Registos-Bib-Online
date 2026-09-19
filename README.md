# Localizador de PDFs e Textos Integrais Bibliográficos
### *Bibliographic Full-Text & PDF Finder*

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-3.8_Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)

---

> **Language / Idioma:**  
> **[English 🇬🇧 (Default)](#-english)** &nbsp;|&nbsp; **[Português 🇵🇹](#-português)**

---

## 🇬🇧 English

An automated batch tool designed for academic libraries, researchers, and catalogers to discover, verify, and link open-access full-text resources (both direct PDFs and digital web readers/repository landing pages) from standard bibliographic Excel/CSV exports (Koha, MARC21, EndNote, etc.).

---

### 🌟 Key Features

- 📑 **Batch Spreadsheet Import/Export**: Upload `.xlsx`, `.xls`, or `.csv` files containing bibliographic records (Title, Author, Year, ISBN, Call Number, Biblionumber).
- 🔍 **Multi-Tier Search Strategy**:
  1. **Internet Archive**: Searches digitized monographs, historical treatises, and borrowable texts via metadata and direct file inspection (`/details/` and `.pdf` bitstreams).
  2. **Open Library**: Direct API queries with ISBN and title/author matching for full-text online lending or digital reading.
  3. **OpenAlex**: Global open access index targeting university repositories, SciELO, and institutional bitstreams.
  4. **RCAAP / b-on (Portugal)**: Scientific open-access repositories searching handles and DSpace bitstreams.
  5. **ERIC (Institute of Education Sciences)**: Educational full-text database (`ED` documents).
  6. **Scopus / CrossRef & Unpaywall**: DOI resolution and green/gold open-access discovery.
  7. **Google Books API**: Digital reading previews and downloadable books.
  8. **Gemini Search Grounding**: Fallback AI search with real-time web grounding and rate-limit (HTTP 429) cooldown protection.
- 🛡️ **Rigorous Metadata Verification**: Every candidate is strictly validated against the record's title, author surname, publication year, and ISBN to reject citations, third-party papers, and false positives.
- 🌐 **Full-Text Type Differentiation**: Clearly distinguishes between **Direct PDF** (`.pdf`), **Web Page** (repository handle/landing page), and **Digital Reader** (Internet Archive BookReader, Open Library).
- ⚡ **Batch & Individual Processing**: Process all records sequentially with pause/resume capabilities, or test single records on demand.
- 📥 **Enriched Export**: Downloads updated XLSX or CSV files containing the original columns plus verified links, source repository, confidence rating, full-text type, and bibliographic notes.

---

### 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons, Motion (Framer Motion).
- **Backend / API**: Node.js, Express, `tsx` (TypeScript execution).
- **AI & Grounding**: `@google/genai` (Gemini 3.8 Flash with Google Search Grounding).
- **File Parsing**: SheetJS (`xlsx`) for client-side Excel and CSV parsing and generation.

---

### 📂 Expected Spreadsheet Format

The application auto-detects standard library catalog headers (case-insensitive):

| Field | Accepted Column Names | Example |
| :--- | :--- | :--- |
| **Title** *(Required)* | `title`, `titulo`, `título`, `obra`, `livro` | *A Escola: o lugar onde os professores aprendem* |
| **Author** | `author`, `autor`, `autores`, `creator` | *Rui Canário* |
| **Publication Year** | `publicationyear`, `ano`, `data`, `ano_publicacao`, `year` | `1999` |
| **ISBN** | `isbn`, `isbn13`, `isbn10`, `issn` | `9789729661440` |
| **Item Call Number** | `itemcallnumber`, `cota`, `callnumber`, `classificacao` | `371.12 CAN ESC` |
| **Biblio Number** | `biblionumber`, `id`, `registo`, `record_id` | `10425` |

---

### 🚀 Getting Started

#### Prerequisites
- **Node.js**: v18.0 or higher
- **npm** or **bun**
- *(Optional)* A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/) for AI web search grounding. Open-access repository APIs (Internet Archive, Open Library, OpenAlex, ERIC, RCAAP) work without any API key.

#### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/bibliographic-pdf-finder.git
   cd bibliographic-pdf-finder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API Key if you want to use the AI grounding fallback:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

5. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

---

### 📦 Available Scripts

- `npm run dev`: Starts the Express server with Vite middleware on port 3000 using `tsx`.
- `npm run build`: Builds the Vite frontend bundle and compiles `server.ts` into `dist/server.cjs` via `esbuild`.
- `npm start`: Runs the compiled CommonJS server in production mode.
- `npm run lint`: Runs `tsc --noEmit` to validate TypeScript types across the project.
- `npm run clean`: Cleans previous build artifacts.

---
---

## 🇵🇹 Português

Uma aplicação concebida para bibliotecas do ensino superior, centros de documentação e investigadores para localizar, validar e associar textos integrais em acesso aberto (tanto ficheiros PDF diretos como páginas web de leitura e repositórios institucionais) a partir de listagens bibliográficas em formato Excel ou CSV (Koha, Porbase, MARC21, etc.).

<img width="692" height="386" alt="Captura de ecrã 2026-09-19 111027" src="https://github.com/user-attachments/assets/f96c6178-8894-4cb7-9354-490b03ed5243" />
<img width="692" height="309" alt="Captura de ecrã 2026-09-19 111108" src="https://github.com/user-attachments/assets/4e4f50df-ba0e-490b-a415-98f0c58dc931" />

---

### 🌟 Principais Funcionalidades

- 📑 **Importação e Exportação de Ficheiros**: Suporte para ficheiros `.xlsx`, `.xls` e `.csv` contendo metadados de catálogo (Título, Autor, Ano, ISBN, Cota, Biblionumber).
- 🔍 **Estratégia de Pesquisa em Múltiplos Níveis**:
  1. **Internet Archive**: Pesquisa em monografias digitalizadas, tratados históricos e obras de domínio público com verificação de ficheiros `.pdf` e leitor BookReader.
  2. **Open Library**: Consulta à API da Open Library por ISBN e título/autor para acesso a obras digitais integrais.
  3. **OpenAlex**: Indexador científico global que interliga repositórios universitários, SciELO e bitstreams abertos.
  4. **b-on / RCAAP**: Repositório Científico de Acesso Aberto de Portugal (busca de *handles* institucionais e ficheiros DSpace).
  5. **ERIC (Institute of Education Sciences)**: Base de dados educacional especializada em relatórios e publicações em texto integral (`ED`).
  6. **Scopus / CrossRef e Unpaywall**: Resolução de DOI para localização de artigos e monografias em acesso aberto (verde/dourado).
  7. **Google Books API**: Pré-visualizações de leitura integral e livros digitalizados para descarregamento.
  8. **Google Gemini Search Grounding**: Pesquisa web complementar com IA e arrefecimento automático caso atinja limites de quota (HTTP 429).
- 🛡️ **Validação Rigorosa de Metadados**: Cada candidato é verificado quanto à correspondência de título, apelido do autor, ano e ISBN, evitando falsos positivos (como artigos de terceiros que apenas citam a obra).
- 🌐 **Diferenciação do Tipo de Texto Integral**: Classificação visual clara entre **PDF Direto** (`.pdf`), **Página Web** (*handle* de repositório) e **Leitor Digital** (Internet Archive BookReader, Open Library).
- ⚡ **Processamento em Lote ou Individual**: Execução sequencial de toda a lista com opções de pausa/retoma ou teste manual de obras individuais.
- 📥 **Exportação Completa**: Descarregamento de um novo ficheiro Excel ou CSV com as colunas originais preservadas e os novos campos adicionados (Link Direto, Fonte, Grau de Confiança, Tipo de Recurso e Notas de Validação).

---

### 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion (Framer Motion).
- **Backend**: Node.js, Express, `tsx`.
- **Inteligência Artificial**: `@google/genai` (modelo Gemini 3.8 Flash com Google Search Grounding).
- **Manipulação de Ficheiros**: SheetJS (`xlsx`) para leitura e escrita cliente de folhas de cálculo.

---

### 📂 Formato de Ficheiro Suportado

A aplicação reconhece automaticamente as seguintes colunas (sem distinção entre maiúsculas e minúsculas):

| Campo | Nomes de Coluna Reconhecidos | Exemplo |
| :--- | :--- | :--- |
| **Título** *(Obrigatório)* | `title`, `titulo`, `título`, `obra`, `livro` | *A Escola: o lugar onde os professores aprendem* |
| **Autor** | `author`, `autor`, `autores`, `creator` | *Rui Canário* |
| **Ano de Publicação** | `publicationyear`, `ano`, `data`, `ano_publicacao`, `year` | `1999` |
| **ISBN** | `isbn`, `isbn13`, `isbn10`, `issn` | `9789729661440` |
| **Cota** | `itemcallnumber`, `cota`, `callnumber`, `classificacao` | `371.12 CAN ESC` |
| **Biblionumber** | `biblionumber`, `id`, `registo`, `record_id` | `10425` |

---

### 🚀 Instalação e Execução

#### Requisitos Prévios
- **Node.js**: versão 18 ou superior
- **npm** ou **bun**
- *(Opcional)* **Chave de API Gemini** do [Google AI Studio](https://aistudio.google.com/). As bases de dados abertas (Internet Archive, Open Library, OpenAlex, ERIC, RCAAP) funcionam sem necessidade de qualquer chave de API.

#### Passos de Configuração

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/SEU_UTILIZADOR/localizador-pdfs-bibliograficos.git
   cd localizador-pdfs-bibliograficos
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente:**
   Copie o ficheiro `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Insira a chave da API Gemini caso pretenda utilizar o motor complementar de pesquisa web por IA:
   ```env
   GEMINI_API_KEY="a_sua_chave_aqui"
   ```

4. **Iniciar em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Aceda no navegador a `http://localhost:3000`.

5. **Compilar para produção:**
   ```bash
   npm run build
   npm start
   ```

---

### 📄 Licença

Distribuído sob licença MIT. Consulte `LICENSE` para mais detalhes.
