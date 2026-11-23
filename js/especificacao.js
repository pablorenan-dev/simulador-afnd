// =====================================================================
// especificacao.js - Editor do autômato, validação e arquivo JSON
// =====================================================================
//
// Parte do João Pedro. Este arquivo:
//   - monta o formulário de especificação (Σ, Q, inicial, F e tabela δ);
//   - valida o autômato antes de entregar para a tela;
//   - salva e abre o autômato em arquivo .json.
//
// O autômato gerado segue exatamente o formato de docs/MOTOR.md:
//    { alfabeto, estados, estadoInicial, estadosFinais, transicoes }
//
// Integração: quando o autômato é válido, este arquivo chama
//    window.usarAutomato(automato)
// que é a função que o js/tela.js deixa disponível. Nada do motor ou da
// tela é alterado.
//
// Ordem dos scripts no index.html: cytoscape, motor.js, tela.js,
// especificacao.js.
//
// Tudo fica dentro de uma função anônima para nenhum nome daqui colidir
// com as funções globais do motor (validarSentenca, buscarDestinos...).
// =====================================================================

(function () {
  "use strict";

  // Usa a constante do motor quando ela existe (navegador). Nos testes em
  // Node o motor não está carregado, então usamos o mesmo caractere.
  const SIMBOLO_EPSILON = typeof EPSILON !== "undefined" ? EPSILON : "ε";

  // Outras formas de escrever ε que são aceitas ao abrir um JSON.
  const APELIDOS_EPSILON = ["&", "λ", "eps", "epsilon"];


  // -------------------------------------------------------------------
  // PARTE 1: funções puras (não usam a página, por isso dá para testar
  // no Node com testes/testar-especificacao.js)
  // -------------------------------------------------------------------

  // Quebra um texto em itens separados por espaço, vírgula ou ponto e
  // vírgula. Ex.: "q0, q1 q2" -> ["q0", "q1", "q2"]
  function separarLista(texto) {
    return String(texto)
      .split(/[\s,;]+/)
      .filter(function (item) { return item !== ""; });
  }

  // Devolve a lista sem itens repetidos, mantendo a ordem.
  function semRepetidos(lista) {
    const resultado = [];
    for (let i = 0; i < lista.length; i++) {
      if (!resultado.includes(lista[i])) {
        resultado.push(lista[i]);
      }
    }
    return resultado;
  }

  // Converte os apelidos de ε (&, λ, eps) para o ε do motor. Se o apelido
  // fizer parte do alfabeto (ex.: "&" como símbolo de verdade), ele não é
  // convertido. A letra "e" nunca é convertida.
  function normalizarSimbolo(simbolo, alfabeto) {
    const texto = String(simbolo).trim();

    if (alfabeto.includes(texto)) {
      return texto;
    }
    if (APELIDOS_EPSILON.includes(texto.toLowerCase())) {
      return SIMBOLO_EPSILON;
    }
    return texto;
  }

  // Monta o autômato a partir do que foi digitado no editor.
  //   dados.alfabeto, dados.estados: listas já separadas
  //   dados.estadoInicial: texto ("" se nenhum foi escolhido)
  //   dados.estadosFinais: lista
  //   dados.celulas: [{ origem, simbolo, texto }] na ordem da tabela
  // Cada célula preenchida vira uma transição; célula vazia não gera nada.
  function montarAutomato(dados) {
    const transicoes = [];

    for (let i = 0; i < dados.celulas.length; i++) {
      const celula = dados.celulas[i];
      const destinos = semRepetidos(separarLista(celula.texto));

      if (destinos.length > 0) {
        transicoes.push({
          origem: celula.origem,
          simbolo: celula.simbolo,
          destinos: destinos
        });
      }
    }

    return {
      alfabeto: dados.alfabeto.slice(),
      estados: dados.estados.slice(),
      estadoInicial: dados.estadoInicial,
      estadosFinais: dados.estadosFinais.slice(),
      transicoes: transicoes
    };
  }

  function ehListaDeTextos(valor) {
    if (!Array.isArray(valor)) {
      return false;
    }
    for (let i = 0; i < valor.length; i++) {
      if (typeof valor[i] !== "string") {
        return false;
      }
    }
    return true;
  }

  // Confere se o objeto tem os 5 campos com os tipos certos. Sem isso o
  // motor quebraria (ele usa .length e .includes direto nos campos).
  function validarEstrutura(automato) {
    const erros = [];

    if (automato === null || typeof automato !== "object" || Array.isArray(automato)) {
      erros.push("O autômato precisa ser um objeto JSON { ... }.");
      return erros;
    }

    if (!ehListaDeTextos(automato.alfabeto)) {
      erros.push("O campo \"alfabeto\" precisa ser uma lista de textos.");
    }
    if (!ehListaDeTextos(automato.estados)) {
      erros.push("O campo \"estados\" precisa ser uma lista de textos.");
    }
    if (typeof automato.estadoInicial !== "string") {
      erros.push("O campo \"estadoInicial\" precisa ser um texto.");
    }
    if (!ehListaDeTextos(automato.estadosFinais)) {
      erros.push("O campo \"estadosFinais\" precisa ser uma lista de textos.");
    }

    if (!Array.isArray(automato.transicoes)) {
      erros.push("O campo \"transicoes\" precisa ser uma lista.");
      return erros;
    }

    for (let i = 0; i < automato.transicoes.length; i++) {
      const t = automato.transicoes[i];
      const onde = "Transição " + (i + 1) + ": ";

      if (t === null || typeof t !== "object" || Array.isArray(t)) {
        erros.push(onde + "precisa ser um objeto { origem, simbolo, destinos }.");
        continue;
      }
      if (typeof t.origem !== "string") {
        erros.push(onde + "\"origem\" precisa ser um texto.");
      }
      if (typeof t.simbolo !== "string") {
        erros.push(onde + "\"simbolo\" precisa ser um texto.");
      }
      if (!ehListaDeTextos(t.destinos)) {
        erros.push(onde + "\"destinos\" precisa ser uma lista de textos.");
      }
    }

    return erros;
  }

  // Ajusta um autômato vindo de arquivo (a estrutura já precisa estar
  // certa): tira espaços das pontas, converte apelidos de ε, une linhas
  // repetidas do mesmo par (origem, símbolo) e destinos repetidos.
  // Devolve um objeto novo só com os 5 campos do formato.
  function normalizarAutomato(automato) {
    // Um símbolo que é só espaço vira "" e a validação acusa o erro.
    const aparar = function (texto) { return texto.trim(); };
    const alfabeto = automato.alfabeto.map(aparar);

    const transicoes = [];
    const porChave = {};

    for (let i = 0; i < automato.transicoes.length; i++) {
      const t = automato.transicoes[i];
      const origem = t.origem.trim();
      const simbolo = normalizarSimbolo(t.simbolo, alfabeto);
      const chave = origem + "\u0000" + simbolo;

      if (porChave[chave] === undefined) {
        porChave[chave] = { origem: origem, simbolo: simbolo, destinos: [] };
        transicoes.push(porChave[chave]);
      }

      const destinos = porChave[chave].destinos;
      for (let j = 0; j < t.destinos.length; j++) {
        const destino = t.destinos[j].trim();
        if (!destinos.includes(destino)) {
          destinos.push(destino);
        }
      }
    }

    return {
      alfabeto: alfabeto,
      estados: automato.estados.map(aparar),
      estadoInicial: automato.estadoInicial.trim(),
      estadosFinais: automato.estadosFinais.map(aparar),
      transicoes: transicoes
    };
  }

  // Texto "δ(q0, a)" usado nas mensagens de erro das transições.
  function nomeCelula(origem, simbolo) {
    return "δ(" + origem + ", " + simbolo + ")";
  }

  // Valida o autômato inteiro. Devolve a lista de mensagens de erro;
  // lista vazia quer dizer que o autômato pode ir para o simulador.
  function validarAutomato(automato) {
    const erros = validarEstrutura(automato);
    if (erros.length > 0) {
      return erros;
    }

    // Alfabeto (Σ)
    const alfabeto = automato.alfabeto;
    if (alfabeto.length === 0) {
      erros.push("O alfabeto está vazio: informe pelo menos um símbolo.");
    }
    for (let i = 0; i < alfabeto.length; i++) {
      const s = alfabeto[i];

      if (s === SIMBOLO_EPSILON) {
        erros.push("O ε não pode fazer parte do alfabeto (use a coluna ε da tabela).");
      } else if (s === "" || /\s/.test(s)) {
        erros.push("O alfabeto tem um símbolo em branco.");
      } else if (s.length !== 1) {
        // O motor lê a sentença caractere por caractere.
        erros.push("O símbolo \"" + s + "\" tem mais de um caractere: cada símbolo do alfabeto deve ter 1 caractere.");
      }
      // Acusa a repetição uma vez só, na segunda ocorrência do símbolo.
      if (i === alfabeto.indexOf(s, alfabeto.indexOf(s) + 1)) {
        erros.push("O símbolo \"" + s + "\" aparece repetido no alfabeto.");
      }
    }

    // Estados (Q)
    const estados = automato.estados;
    if (estados.length === 0) {
      erros.push("Nenhum estado informado.");
    }
    for (let i = 0; i < estados.length; i++) {
      const e = estados[i];

      if (e === "") {
        erros.push("Há um estado com nome em branco.");
      } else if (/[\s,;]/.test(e)) {
        erros.push("O estado \"" + e + "\" não pode ter espaço, vírgula ou ponto e vírgula no nome.");
      }
      if (i === estados.indexOf(e, estados.indexOf(e) + 1)) {
        erros.push("O estado \"" + e + "\" aparece repetido.");
      }
    }

    // Estado inicial
    if (automato.estadoInicial === "") {
      erros.push("Escolha o estado inicial.");
    } else if (!estados.includes(automato.estadoInicial)) {
      erros.push("O estado inicial \"" + automato.estadoInicial + "\" não está na lista de estados.");
    }

    // Estados finais (F)
    const finais = automato.estadosFinais;
    for (let i = 0; i < finais.length; i++) {
      const f = finais[i];
      if (!estados.includes(f)) {
        erros.push("O estado final \"" + f + "\" não está na lista de estados.");
      }
      if (i === finais.indexOf(f, finais.indexOf(f) + 1)) {
        erros.push("O estado final \"" + f + "\" aparece repetido.");
      }
    }

    // Transições (δ)
    for (let i = 0; i < automato.transicoes.length; i++) {
      const t = automato.transicoes[i];
      const onde = nomeCelula(t.origem, t.simbolo) + ": ";

      if (!estados.includes(t.origem)) {
        erros.push(onde + "o estado de origem \"" + t.origem + "\" não existe.");
      }
      if (t.simbolo !== SIMBOLO_EPSILON && !alfabeto.includes(t.simbolo)) {
        erros.push(onde + "o símbolo \"" + t.simbolo + "\" não está no alfabeto.");
      }
      if (t.destinos.length === 0) {
        erros.push(onde + "a transição não tem nenhum estado de destino.");
      }
      for (let j = 0; j < t.destinos.length; j++) {
        if (!estados.includes(t.destinos[j])) {
          erros.push(onde + "o estado de destino \"" + t.destinos[j] + "\" não existe.");
        }
      }
    }

    return erros;
  }

  // Cópia independente, para a tela não ser afetada por edições futuras.
  function copiarAutomato(automato) {
    return JSON.parse(JSON.stringify(automato));
  }

  // Texto do arquivo .json salvo: só os 5 campos, no mesmo jeito de
  // docs/MOTOR.md (listas em uma linha e uma transição por linha), para
  // o arquivo ficar fácil de ler e de editar à mão.
  function gerarTextoJSON(automato) {
    const lista = function (valores) {
      return "[" + valores.map(function (v) { return JSON.stringify(v); }).join(", ") + "]";
    };

    const linhasTransicoes = automato.transicoes.map(function (t) {
      return "    { \"origem\": " + JSON.stringify(t.origem) +
        ", \"simbolo\": " + JSON.stringify(t.simbolo) +
        ", \"destinos\": " + lista(t.destinos) + " }";
    });

    return "{\n" +
      "  \"alfabeto\": " + lista(automato.alfabeto) + ",\n" +
      "  \"estados\": " + lista(automato.estados) + ",\n" +
      "  \"estadoInicial\": " + JSON.stringify(automato.estadoInicial) + ",\n" +
      "  \"estadosFinais\": " + lista(automato.estadosFinais) + ",\n" +
      "  \"transicoes\": [\n" + linhasTransicoes.join(",\n") + "\n  ]\n" +
      "}\n";
  }

  // Lê o texto de um arquivo .json. Devolve { automato, erros }:
  // se "erros" não estiver vazio, "automato" é null.
  function lerTextoJSON(texto) {
    let dados;

    try {
      dados = JSON.parse(texto);
    } catch (erro) {
      return { automato: null, erros: ["O arquivo não é um JSON válido (" + erro.message + ")."] };
    }

    const errosEstrutura = validarEstrutura(dados);
    if (errosEstrutura.length > 0) {
      return { automato: null, erros: errosEstrutura };
    }

    const automato = normalizarAutomato(dados);
    const erros = validarAutomato(automato);
    if (erros.length > 0) {
      return { automato: null, erros: erros };
    }

    return { automato: automato, erros: [] };
  }


  // Exporta as funções puras para os testes em Node (no navegador não
  // existe "module" e esta parte é ignorada).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      SIMBOLO_EPSILON,
      separarLista,
      normalizarSimbolo,
      montarAutomato,
      validarEstrutura,
      normalizarAutomato,
      validarAutomato,
      gerarTextoJSON,
      lerTextoJSON
    };
  }

  // Daqui para baixo é só a página. No Node não há document.
  if (typeof document === "undefined") {
    return;
  }


  // -------------------------------------------------------------------
  // PARTE 2: formulário do editor
  // -------------------------------------------------------------------

  const el = {
    form: document.getElementById("form-especificacao"),
    alfabeto: document.getElementById("esp-alfabeto"),
    estados: document.getElementById("esp-estados"),
    btnMontar: document.getElementById("esp-montar"),
    detalhes: document.getElementById("esp-detalhes"),
    inicial: document.getElementById("esp-inicial"),
    finais: document.getElementById("esp-finais"),
    tabela: document.getElementById("esp-tabela"),
    erros: document.getElementById("esp-erros"),
    status: document.getElementById("esp-status"),
    btnSalvar: document.getElementById("esp-salvar"),
    btnAbrir: document.getElementById("esp-abrir"),
    arquivo: document.getElementById("esp-arquivo"),
    seletorExemplo: document.getElementById("exemplo") // seletor da tela
  };

  // Nome sugerido ao salvar: o do último arquivo aberto, ou o padrão.
  let nomeArquivo = "automato.json";

  // Se o HTML do editor não estiver na página, não faz nada.
  if (el.form === null) {
    return;
  }

  // Guarda o que já foi digitado, para não perder ao remontar a tabela.
  function lerValoresAtuais() {
    const celulas = {};
    const entradas = el.tabela.querySelectorAll("input.esp-celula");
    for (let i = 0; i < entradas.length; i++) {
      const entrada = entradas[i];
      celulas[entrada.dataset.origem + "\u0000" + entrada.dataset.simbolo] = entrada.value;
    }

    const finais = [];
    const marcados = el.finais.querySelectorAll("input:checked");
    for (let i = 0; i < marcados.length; i++) {
      finais.push(marcados[i].value);
    }

    return { inicial: el.inicial.value, finais: finais, celulas: celulas };
  }

  // Monta (ou remonta) o estado inicial, os finais e a tabela δ a partir
  // dos campos de alfabeto e estados. O que já estava preenchido e
  // continua existindo é mantido.
  function montarTabela() {
    const anterior = lerValoresAtuais();
    const simbolos = semRepetidos(separarLista(el.alfabeto.value));
    const estados = semRepetidos(separarLista(el.estados.value));
    const colunas = simbolos.concat([SIMBOLO_EPSILON]);

    // Estado inicial
    el.inicial.textContent = "";
    adicionarOpcao(el.inicial, "", "— escolha —");
    for (let i = 0; i < estados.length; i++) {
      adicionarOpcao(el.inicial, estados[i], estados[i]);
    }
    el.inicial.value = estados.includes(anterior.inicial) ? anterior.inicial : "";

    // Estados finais
    el.finais.textContent = "";
    for (let i = 0; i < estados.length; i++) {
      const rotulo = document.createElement("label");
      rotulo.className = "esp-final";
      const caixa = document.createElement("input");
      caixa.type = "checkbox";
      caixa.value = estados[i];
      caixa.checked = anterior.finais.includes(estados[i]);
      rotulo.appendChild(caixa);
      rotulo.appendChild(document.createTextNode(estados[i]));
      el.finais.appendChild(rotulo);
    }
    if (estados.length === 0) {
      el.finais.innerHTML = '<span class="texto-suave">—</span>';
    }

    // Tabela δ: uma linha por estado, uma coluna por símbolo + ε.
    const thead = el.tabela.tHead;
    const tbody = el.tabela.tBodies[0];
    thead.textContent = "";
    tbody.textContent = "";

    const cabecalho = document.createElement("tr");
    adicionarCelula(cabecalho, "th", "δ");
    for (let j = 0; j < colunas.length; j++) {
      adicionarCelula(cabecalho, "th", colunas[j]);
    }
    thead.appendChild(cabecalho);

    for (let i = 0; i < estados.length; i++) {
      const linha = document.createElement("tr");
      adicionarCelula(linha, "th", estados[i]);

      for (let j = 0; j < colunas.length; j++) {
        const td = document.createElement("td");
        const entrada = document.createElement("input");
        entrada.type = "text";
        entrada.className = "esp-celula";
        entrada.dataset.origem = estados[i];
        entrada.dataset.simbolo = colunas[j];
        entrada.placeholder = "—";
        entrada.autocomplete = "off";
        entrada.spellcheck = false;
        entrada.setAttribute("autocapitalize", "off");
        entrada.setAttribute("aria-label", nomeCelula(estados[i], colunas[j]));
        entrada.value = anterior.celulas[estados[i] + "\u0000" + colunas[j]] || "";
        td.appendChild(entrada);
        linha.appendChild(td);
      }
      tbody.appendChild(linha);
    }

    el.detalhes.hidden = false;
  }

  function adicionarOpcao(select, valor, texto) {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    select.appendChild(opcao);
  }

  function adicionarCelula(linha, tipo, texto) {
    const celula = document.createElement(tipo);
    celula.textContent = texto;
    linha.appendChild(celula);
    return celula;
  }

  // Lê o editor inteiro e devolve o autômato no formato do motor.
  // A tabela é remontada antes, para refletir o alfabeto e os estados
  // digitados por último.
  function lerEditor() {
    montarTabela();

    const valores = lerValoresAtuais();
    const celulas = [];
    const entradas = el.tabela.querySelectorAll("input.esp-celula");
    for (let i = 0; i < entradas.length; i++) {
      celulas.push({
        origem: entradas[i].dataset.origem,
        simbolo: entradas[i].dataset.simbolo,
        texto: entradas[i].value
      });
    }

    return montarAutomato({
      // Aqui as listas NÃO tiram repetidos, para a validação acusar.
      alfabeto: separarLista(el.alfabeto.value),
      estados: separarLista(el.estados.value),
      estadoInicial: valores.inicial,
      estadosFinais: valores.finais,
      celulas: celulas
    });
  }

  // Coloca um autômato (já validado) dentro do editor.
  function preencherEditor(automato) {
    el.alfabeto.value = automato.alfabeto.join(" ");
    el.estados.value = automato.estados.join(" ");

    // Limpa a tabela antiga para não misturar valores.
    el.tabela.tHead.textContent = "";
    el.tabela.tBodies[0].textContent = "";
    el.finais.textContent = "";
    el.inicial.textContent = "";
    montarTabela();

    el.inicial.value = automato.estadoInicial;

    const caixas = el.finais.querySelectorAll("input[type=checkbox]");
    for (let i = 0; i < caixas.length; i++) {
      caixas[i].checked = automato.estadosFinais.includes(caixas[i].value);
    }

    const entradas = el.tabela.querySelectorAll("input.esp-celula");
    for (let i = 0; i < entradas.length; i++) {
      entradas[i].value = "";
    }
    for (let i = 0; i < automato.transicoes.length; i++) {
      const t = automato.transicoes[i];
      for (let j = 0; j < entradas.length; j++) {
        if (entradas[j].dataset.origem === t.origem && entradas[j].dataset.simbolo === t.simbolo) {
          entradas[j].value = t.destinos.join(", ");
        }
      }
    }
  }


  // -------------------------------------------------------------------
  // PARTE 3: mensagens e integração com a tela
  // -------------------------------------------------------------------

  function mostrarErros(titulo, erros) {
    esconderStatus();
    el.erros.textContent = "";

    const forte = document.createElement("strong");
    forte.textContent = titulo;
    el.erros.appendChild(forte);

    const lista = document.createElement("ul");
    for (let i = 0; i < erros.length; i++) {
      const item = document.createElement("li");
      item.textContent = erros[i];
      lista.appendChild(item);
    }
    el.erros.appendChild(lista);
    el.erros.hidden = false;
  }

  function esconderErros() {
    el.erros.hidden = true;
    el.erros.textContent = "";
  }

  function mostrarStatus(texto) {
    el.status.textContent = texto;
    el.status.hidden = false;
  }

  function esconderStatus() {
    el.status.hidden = true;
    el.status.textContent = "";
  }

  // Entrega um autômato válido para a tela (js/tela.js).
  function enviarParaTela(automato) {
    if (typeof window.usarAutomato !== "function") {
      mostrarErros("Não foi possível aplicar:", [
        "A tela do simulador (js/tela.js) não foi carregada."
      ]);
      return false;
    }

    window.usarAutomato(copiarAutomato(automato));

    // O seletor de exemplos da tela fica em branco, porque o autômato em
    // uso agora é o do editor. Mudar selectedIndex não dispara "change".
    if (el.seletorExemplo !== null) {
      el.seletorExemplo.selectedIndex = -1;
    }
    return true;
  }

  // Botão "Aplicar ao simulador".
  function aplicar() {
    const automato = lerEditor();
    const erros = validarAutomato(automato);

    if (erros.length > 0) {
      mostrarErros("Corrija o autômato antes de aplicar:", erros);
      return;
    }

    esconderErros();
    if (enviarParaTela(automato)) {
      mostrarStatus("Autômato aplicado ao simulador.");
    }
  }


  // -------------------------------------------------------------------
  // PARTE 4: salvar e abrir arquivo JSON
  // -------------------------------------------------------------------

  // Botão "Salvar JSON": baixa o autômato do editor como arquivo.
  // Usa Blob + link de download, que funciona abrindo a página direto
  // do arquivo (file://), sem servidor.
  function salvarJSON() {
    const automato = lerEditor();
    const erros = validarAutomato(automato);

    if (erros.length > 0) {
      mostrarErros("Corrija o autômato antes de salvar:", erros);
      return;
    }

    const blob = new Blob([gerarTextoJSON(automato)], { type: "application/json" });
    const endereco = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = endereco;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Libera a memória depois que o navegador já começou o download.
    setTimeout(function () { URL.revokeObjectURL(endereco); }, 1000);

    esconderErros();
    mostrarStatus("Autômato salvo em " + nomeArquivo + ".");
  }

  // Campo de arquivo do botão "Abrir JSON". Usa FileReader, porque
  // fetch não consegue ler arquivos locais quando a página é file://.
  function abrirJSON() {
    const arquivo = el.arquivo.files[0];
    if (!arquivo) {
      return;
    }

    const leitor = new FileReader();

    leitor.onload = function () {
      const lido = lerTextoJSON(String(leitor.result));

      if (lido.erros.length > 0) {
        mostrarErros("Não foi possível abrir \"" + arquivo.name + "\":", lido.erros);
        return;
      }

      nomeArquivo = arquivo.name;
      preencherEditor(lido.automato);
      esconderErros();
      if (enviarParaTela(lido.automato)) {
        mostrarStatus("\"" + arquivo.name + "\" aberto e aplicado ao simulador.");
      }
    };

    leitor.onerror = function () {
      mostrarErros("Não foi possível abrir \"" + arquivo.name + "\":", ["Erro ao ler o arquivo."]);
    };

    leitor.readAsText(arquivo, "utf-8");

    // Limpa o campo para o mesmo arquivo poder ser aberto de novo.
    el.arquivo.value = "";
  }


  // -------------------------------------------------------------------
  // PARTE 5: eventos
  // -------------------------------------------------------------------

  el.btnSalvar.addEventListener("click", salvarJSON);
  el.btnAbrir.addEventListener("click", function () {
    el.arquivo.click();
  });
  el.arquivo.addEventListener("change", abrirJSON);

  el.btnMontar.addEventListener("click", function () {
    montarTabela();
    esconderStatus();
  });

  // Ao sair do campo de alfabeto ou de estados, a tabela já se ajusta.
  el.alfabeto.addEventListener("change", montarTabela);
  el.estados.addEventListener("change", montarTabela);

  el.form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    aplicar();
  });

  // Qualquer edição invalida a mensagem "aplicado".
  el.form.addEventListener("input", esconderStatus);
})();
