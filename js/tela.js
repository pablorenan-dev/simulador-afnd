// =====================================================================
// tela.js - Tela de execução do simulador
// =====================================================================
//
// Este arquivo desenha o que o motor (js/motor.js) devolve. Ele não faz
// conta nenhuma de autômato: só chama criarSimulacao, avancarPasso e
// obterResumo, e mostra o resultado.
//
// Ordem dos scripts no index.html: cytoscape, motor.js, tela.js.
//
// PARA O EDITOR (João Pedro):
// Quando o usuário terminar de montar ou carregar um autômato, chame
//    usarAutomato(automato);
// com o objeto no formato de docs/MOTOR.md. A tela descarta a simulação
// que estiver aberta e passa a usar o autômato novo.
// =====================================================================

(function () {
  "use strict";

  // -------------------------------------------------------------------
  // Autômatos de exemplo (os mesmos de testes/testar-motor.js)
  // -------------------------------------------------------------------

  const EXEMPLOS = [
    {
      nome: "AFND: termina em abb",
      automato: {
        alfabeto: ["a", "b"],
        estados: ["q0", "q1", "q2", "q3"],
        estadoInicial: "q0",
        estadosFinais: ["q3"],
        transicoes: [
          { origem: "q0", simbolo: "a", destinos: ["q0", "q1"] },
          { origem: "q0", simbolo: "b", destinos: ["q0"] },
          { origem: "q1", simbolo: "b", destinos: ["q2"] },
          { origem: "q2", simbolo: "b", destinos: ["q3"] }
        ]
      }
    },
    {
      nome: "AFND-ε: a* b*",
      automato: {
        alfabeto: ["a", "b"],
        estados: ["q0", "q1"],
        estadoInicial: "q0",
        estadosFinais: ["q1"],
        transicoes: [
          { origem: "q0", simbolo: "a", destinos: ["q0"] },
          { origem: "q0", simbolo: "ε", destinos: ["q1"] },
          { origem: "q1", simbolo: "b", destinos: ["q1"] }
        ]
      }
    },
    {
      nome: "AFND-ε: com ciclo de ε",
      automato: {
        alfabeto: ["a"],
        estados: ["q0", "q1", "q2"],
        estadoInicial: "q0",
        estadosFinais: ["q2"],
        transicoes: [
          { origem: "q0", simbolo: "ε", destinos: ["q1"] },
          { origem: "q1", simbolo: "ε", destinos: ["q0", "q1"] },
          { origem: "q1", simbolo: "a", destinos: ["q2"] }
        ]
      }
    }
  ];

  // Texto mostrado para cada situação de nó (as chaves são as do motor).
  const ROTULO_SITUACAO = {
    ativo: "ativo",
    expandido: "expandido",
    morto: "morto",
    ciclo: "ciclo de ε",
    aceito: "aceito",
    rejeitado: "rejeitado"
  };


  // -------------------------------------------------------------------
  // Elementos da página e estado da tela
  // -------------------------------------------------------------------

  const el = {
    exemplo: document.getElementById("exemplo"),
    definicao: document.getElementById("definicao"),
    tabelaDelta: document.getElementById("tabela-delta"),
    formSentenca: document.getElementById("form-sentenca"),
    sentenca: document.getElementById("sentenca"),
    erro: document.getElementById("erro"),
    btnPasso: document.getElementById("btn-passo"),
    btnTudo: document.getElementById("btn-tudo"),
    btnReiniciar: document.getElementById("btn-reiniciar"),
    btnCentralizar: document.getElementById("btn-centralizar"),
    contador: document.getElementById("contador"),
    fita: document.getElementById("fita"),
    resultado: document.getElementById("resultado"),
    estados: document.getElementById("estados"),
    ramos: document.getElementById("ramos"),
    arvore: document.getElementById("arvore"),
    arvoreAviso: document.getElementById("arvore-aviso"),
    detalheNo: document.getElementById("detalhe-no")
  };

  let automato = null;     // autômato em uso
  let simulacao = null;    // simulação do motor (null antes de iniciar)
  let sentencaAtual = "";  // sentença da simulação aberta, para o Reiniciar
  let ultimoResumo = null; // último obterResumo, usado no clique de um nó
  let cy = null;           // instância do Cytoscape (criada na primeira vez)


  // -------------------------------------------------------------------
  // PARTE 1: autômato
  // -------------------------------------------------------------------

  // Troca o autômato em uso. É a função que o editor deve chamar.
  function usarAutomato(novoAutomato) {
    automato = novoAutomato;
    limparSimulacao();
    desenharAutomato([]);
  }

  function preencherExemplos() {
    for (let i = 0; i < EXEMPLOS.length; i++) {
      const opcao = document.createElement("option");
      opcao.value = String(i);
      opcao.textContent = EXEMPLOS[i].nome;
      el.exemplo.appendChild(opcao);
    }
  }

  // Diz se alguma transição do autômato usa ε.
  function usaEpsilon(aut) {
    for (let i = 0; i < aut.transicoes.length; i++) {
      if (aut.transicoes[i].simbolo === EPSILON) {
        return true;
      }
    }
    return false;
  }

  function textoConjunto(lista) {
    if (lista.length === 0) {
      return "∅";
    }
    return "{" + lista.join(", ") + "}";
  }

  // Mostra a definição formal e a tabela δ. As linhas dos estados em
  // "destacados" ficam marcadas (são os estados possíveis do instante).
  function desenharAutomato(destacados) {
    el.definicao.textContent = "";
    adicionarDefinicao("Σ", textoConjunto(automato.alfabeto));
    adicionarDefinicao("Q", textoConjunto(automato.estados));
    adicionarDefinicao("Inicial", automato.estadoInicial);
    adicionarDefinicao("F", textoConjunto(automato.estadosFinais));

    // Colunas: os símbolos do alfabeto e, se for AFND-ε, a coluna ε.
    const colunas = automato.alfabeto.slice();
    if (usaEpsilon(automato)) {
      colunas.push(EPSILON);
    }

    const thead = el.tabelaDelta.tHead;
    const tbody = el.tabelaDelta.tBodies[0];
    thead.textContent = "";
    tbody.textContent = "";

    const linhaCabecalho = document.createElement("tr");
    adicionarCelula(linhaCabecalho, "th", "δ");
    for (let i = 0; i < colunas.length; i++) {
      adicionarCelula(linhaCabecalho, "th", colunas[i]);
    }
    thead.appendChild(linhaCabecalho);

    for (let i = 0; i < automato.estados.length; i++) {
      const estado = automato.estados[i];
      const linha = document.createElement("tr");

      let marca = "";
      if (estado === automato.estadoInicial) {
        marca += "→";
      }
      if (automato.estadosFinais.includes(estado)) {
        marca += "*";
      }
      adicionarCelula(linha, "th", marca + estado);

      for (let j = 0; j < colunas.length; j++) {
        // buscarDestinos é do motor e já junta destinos repetidos.
        const destinos = buscarDestinos(automato, estado, colunas[j]);
        const celula = adicionarCelula(linha, "td", destinos.length > 0 ? textoConjunto(destinos) : "—");
        if (destinos.length === 0) {
          celula.className = "sem-transicao";
        }
      }

      if (destacados.includes(estado)) {
        linha.className = "destacado";
      }
      tbody.appendChild(linha);
    }
  }

  function adicionarDefinicao(termo, valor) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = termo;
    dd.textContent = valor;
    el.definicao.appendChild(dt);
    el.definicao.appendChild(dd);
  }

  function adicionarCelula(linha, tipo, texto) {
    const celula = document.createElement(tipo);
    celula.textContent = texto;
    linha.appendChild(celula);
    return celula;
  }


  // -------------------------------------------------------------------
  // PARTE 2: controle da simulação
  // -------------------------------------------------------------------

  function iniciarSimulacao(sentenca) {
    esconderErro();

    try {
      simulacao = criarSimulacao(automato, sentenca);
    } catch (erro) {
      // Sentença com símbolo fora do alfabeto.
      limparSimulacao();
      mostrarErro(erro.message);
      return;
    }

    sentencaAtual = sentenca;
    desenharTudo();
  }

  function proximoPasso() {
    if (simulacao === null || simulacao.terminou) {
      return;
    }
    avancarPasso(simulacao);
    desenharTudo();
  }

  // Roda até o fim. Cada passo lê um símbolo, então o laço para sozinho.
  function executarTudo() {
    if (simulacao === null) {
      return;
    }
    while (!simulacao.terminou) {
      avancarPasso(simulacao);
    }
    desenharTudo();
  }

  function reiniciar() {
    if (simulacao === null) {
      return;
    }
    iniciarSimulacao(sentencaAtual);
  }

  // Volta a tela para o estado "nenhuma simulação".
  function limparSimulacao() {
    simulacao = null;
    sentencaAtual = "";
    ultimoResumo = null;

    el.contador.textContent = "";
    el.fita.textContent = "";
    const vazio = document.createElement("span");
    vazio.className = "fita-vazia";
    vazio.textContent = "Nenhuma simulação em andamento.";
    el.fita.appendChild(vazio);

    el.resultado.hidden = true;
    el.estados.innerHTML = '<span class="texto-suave">—</span>';
    el.ramos.innerHTML = '<li class="texto-suave">—</li>';
    el.detalheNo.textContent = "Toque em um nó para ver o caminho até ele.";

    if (cy !== null) {
      cy.elements().remove();
    }
    mostrarAvisoArvore("Digite uma sentença e clique em Iniciar.");

    if (automato !== null) {
      desenharAutomato([]);
    }
    atualizarBotoes();
  }

  function atualizarBotoes() {
    const podeAvancar = simulacao !== null && !simulacao.terminou;
    el.btnPasso.disabled = !podeAvancar;
    el.btnTudo.disabled = !podeAvancar;
    el.btnReiniciar.disabled = simulacao === null;
    el.btnCentralizar.disabled = simulacao === null || cy === null;
  }

  function mostrarErro(mensagem) {
    el.erro.textContent = mensagem;
    el.erro.hidden = false;
  }

  function esconderErro() {
    el.erro.hidden = true;
    el.erro.textContent = "";
  }


  // -------------------------------------------------------------------
  // PARTE 3: desenho do instante atual
  // -------------------------------------------------------------------

  function desenharTudo() {
    const resumo = obterResumo(simulacao);
    ultimoResumo = resumo;

    desenharFita(resumo);
    desenharResultado(resumo);
    desenharEstados(resumo);
    desenharRamos(resumo);
    desenharAutomato(resumo.estadosPossiveis);
    desenharArvore(resumo);
    atualizarBotoes();
  }

  function desenharFita(resumo) {
    const entrada = resumo.lido + resumo.restante;
    el.fita.textContent = "";
    el.contador.textContent = "lidos " + resumo.posicao + " de " + entrada.length;

    if (entrada.length === 0) {
      const celula = document.createElement("span");
      celula.className = "celula vazia";
      celula.textContent = "ε (sentença vazia)";
      el.fita.appendChild(celula);
      return;
    }

    for (let i = 0; i < entrada.length; i++) {
      const celula = document.createElement("span");
      celula.textContent = entrada[i];

      if (i < resumo.posicao) {
        celula.className = "celula lida";
      } else if (i === resumo.posicao && !resumo.terminou) {
        celula.className = "celula atual";
        celula.title = "próximo símbolo";
      } else if (resumo.terminou) {
        // A simulação parou antes: estes símbolos nunca foram lidos.
        celula.className = "celula nao-lida";
        celula.title = "não lido";
      } else {
        celula.className = "celula";
      }

      el.fita.appendChild(celula);
    }
  }

  function desenharResultado(resumo) {
    el.resultado.hidden = false;
    el.resultado.textContent = "";

    const titulo = document.createElement("strong");
    const detalhe = document.createElement("span");

    if (!resumo.terminou) {
      el.resultado.className = "resultado";
      titulo.textContent = "Em execução";
      if (resumo.proximoSimbolo !== null) {
        detalhe.textContent = "Próximo símbolo: " + resumo.proximoSimbolo;
      }
    } else if (resumo.resultado === RESULTADO_ACEITA) {
      el.resultado.className = "resultado aceita";
      titulo.textContent = "ACEITA";
      detalhe.textContent = "Pelo menos um ramo terminou a entrada em estado final.";
    } else {
      el.resultado.className = "resultado rejeitada";
      titulo.textContent = "REJEITADA";
      if (resumo.restante.length > 0) {
        detalhe.textContent = "Todos os ramos morreram com " + resumo.restante.length +
          " símbolo(s) ainda por ler.";
      } else {
        detalhe.textContent = "Nenhum ramo terminou a entrada em estado final.";
      }
    }

    el.resultado.appendChild(titulo);
    el.resultado.appendChild(detalhe);
  }

  function desenharEstados(resumo) {
    el.estados.textContent = "";

    if (resumo.estadosPossiveis.length === 0) {
      const vazio = document.createElement("span");
      vazio.className = "texto-suave";
      vazio.textContent = "∅ (nenhum estado)";
      el.estados.appendChild(vazio);
      return;
    }

    for (let i = 0; i < resumo.estadosPossiveis.length; i++) {
      const estado = resumo.estadosPossiveis[i];
      const chip = document.createElement("span");
      chip.className = "chip-estado";
      if (automato.estadosFinais.includes(estado)) {
        chip.className += " final";
        chip.title = "estado final";
      }
      chip.textContent = estado;
      el.estados.appendChild(chip);
    }
  }

  function desenharRamos(resumo) {
    el.ramos.textContent = "";

    // Sem ramos no instante atual: todos morreram no último símbolo lido.
    if (resumo.ramosAtuais.length === 0) {
      const item = document.createElement("li");
      item.className = "texto-suave";
      item.textContent = "Nenhum ramo restante: todos morreram antes do fim da entrada.";
      el.ramos.appendChild(item);
      return;
    }

    for (let i = 0; i < resumo.ramosAtuais.length; i++) {
      const ramo = resumo.ramosAtuais[i];
      const item = document.createElement("li");
      item.className = ramo.situacao;

      const selo = document.createElement("span");
      selo.className = "selo " + ramo.situacao;
      selo.textContent = ROTULO_SITUACAO[ramo.situacao] || ramo.situacao;

      const caminho = document.createElement("code");
      caminho.textContent = ramo.caminho;

      item.appendChild(selo);
      item.appendChild(caminho);
      el.ramos.appendChild(item);
    }
  }


  // -------------------------------------------------------------------
  // PARTE 4: árvore de execução (Cytoscape)
  // -------------------------------------------------------------------

  // Lê uma cor das variáveis do CSS, para a árvore seguir o tema.
  function cor(nome) {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  }

  function estiloArvore() {
    return [
      {
        selector: "node",
        style: {
          "label": "data(estado)",
          "text-valign": "center",
          "text-halign": "center",
          "font-family": cor("--fonte-mono") || "monospace",
          "font-size": 13,
          "font-weight": 600,
          "color": cor("--no-texto"),
          "width": 42,
          "height": 42,
          "background-color": cor("--sit-expandido"),
          "border-width": 0
        }
      },
      { selector: "node.ativo", style: { "background-color": cor("--sit-ativo") } },
      { selector: "node.expandido", style: { "background-color": cor("--sit-expandido") } },
      { selector: "node.morto", style: { "background-color": cor("--sit-morto") } },
      {
        selector: "node.ciclo",
        style: {
          "background-color": cor("--sit-ciclo"),
          "border-width": 2,
          "border-style": "dashed",
          "border-color": cor("--texto")
        }
      },
      { selector: "node.aceito", style: { "background-color": cor("--sit-aceito") } },
      { selector: "node.rejeitado", style: { "background-color": cor("--sit-rejeitado") } },
      {
        // Estado final do autômato: borda dupla, como no desenho de AF.
        selector: "node.final",
        style: {
          "border-width": 5,
          "border-style": "double",
          "border-color": cor("--texto")
        }
      },
      {
        // Nós do instante atual (criados depois do último símbolo lido).
        selector: "node.atual",
        style: {
          "underlay-color": cor("--destaque"),
          "underlay-padding": 6,
          "underlay-opacity": 0.28,
          "underlay-shape": "ellipse"
        }
      },
      {
        selector: "node:selected",
        style: {
          "overlay-color": cor("--texto"),
          "overlay-padding": 4,
          "overlay-opacity": 0.15
        }
      },
      {
        selector: "edge",
        style: {
          "label": "data(simbolo)",
          "curve-style": "bezier",
          "width": 2,
          "line-color": cor("--aresta"),
          "target-arrow-color": cor("--aresta"),
          "target-arrow-shape": "triangle",
          "font-family": cor("--fonte-mono") || "monospace",
          "font-size": 13,
          "color": cor("--texto"),
          "text-background-color": cor("--fundo"),
          "text-background-opacity": 1,
          "text-background-padding": 2
        }
      },
      { selector: "edge.epsilon", style: { "line-style": "dashed" } }
    ];
  }

  // Cria o Cytoscape na primeira vez. Devolve false se a biblioteca não
  // carregou (por exemplo, sem internet para baixar do CDN).
  function prepararArvore() {
    if (cy !== null) {
      return true;
    }

    if (typeof window.cytoscape !== "function") {
      mostrarAvisoArvore("Não foi possível carregar o Cytoscape (sem internet?). " +
        "O resto da tela funciona normalmente.");
      return false;
    }

    cy = window.cytoscape({
      container: el.arvore,
      style: estiloArvore(),
      minZoom: 0.15,
      maxZoom: 3,
      boxSelectionEnabled: false
    });

    cy.on("tap", "node", function (evento) {
      mostrarDetalheNo(evento.target.data("idMotor"));
    });

    cy.on("tap", function (evento) {
      if (evento.target === cy) {
        el.detalheNo.textContent = "Toque em um nó para ver o caminho até ele.";
      }
    });

    // Se o sistema trocar entre claro e escuro, repinta a árvore.
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        cy.style(estiloArvore());
      });
    }

    return true;
  }

  function desenharArvore(resumo) {
    if (!prepararArvore()) {
      return;
    }
    esconderAvisoArvore();
    el.detalheNo.textContent = "Toque em um nó para ver o caminho até ele.";

    // Cada nó do motor vira um nó; cada idPai vira uma aresta pai -> filho.
    // O motor devolve os nós na ordem em que nasceram, então o pai sempre
    // entra antes do filho e a aresta já encontra os dois.
    const elementos = [];

    for (let i = 0; i < resumo.arvore.length; i++) {
      const no = resumo.arvore[i];

      let classes = no.situacao;
      if (automato.estadosFinais.includes(no.estado)) {
        classes += " final";
      }
      if (no.posicao === resumo.posicao) {
        classes += " atual";
      }

      elementos.push({
        group: "nodes",
        data: { id: "n" + no.id, idMotor: no.id, estado: no.estado },
        classes: classes
      });

      if (no.idPai !== null) {
        elementos.push({
          group: "edges",
          data: {
            id: "e" + no.id,
            source: "n" + no.idPai,
            target: "n" + no.id,
            simbolo: no.simboloUsado
          },
          classes: no.simboloUsado === EPSILON ? "epsilon" : ""
        });
      }
    }

    cy.batch(function () {
      cy.elements().remove();
      cy.add(elementos);
    });

    // Layout pela hierarquia da árvore, e não pelo campo "posicao": os
    // filhos por ε têm a mesma posição do pai e ficariam na mesma linha.
    cy.layout({
      name: "breadthfirst",
      directed: true,
      roots: "#n0",
      spacingFactor: 1.1,
      padding: 24,
      animate: false,
      fit: true
    }).run();

    // Árvore pequena não precisa ficar gigante na tela.
    if (cy.zoom() > 1.4) {
      cy.zoom(1.4);
      cy.center();
    }
  }

  // Mostra o caminho da raiz até o nó clicado.
  function mostrarDetalheNo(idMotor) {
    if (ultimoResumo === null) {
      return;
    }

    // Índice dos nós por id, para subir pelos pais.
    const porId = {};
    for (let i = 0; i < ultimoResumo.arvore.length; i++) {
      porId[ultimoResumo.arvore[i].id] = ultimoResumo.arvore[i];
    }

    const no = porId[idMotor];
    let atual = no;
    let caminho = atual.estado;

    while (atual.idPai !== null) {
      const pai = porId[atual.idPai];
      caminho = pai.estado + " -" + atual.simboloUsado + "-> " + caminho;
      atual = pai;
    }

    el.detalheNo.textContent = caminho + "  ·  " +
      (ROTULO_SITUACAO[no.situacao] || no.situacao) + "  ·  " +
      no.posicao + " símbolo(s) lido(s)";
  }

  function centralizarArvore() {
    if (cy !== null) {
      cy.fit(undefined, 24);
      if (cy.zoom() > 1.4) {
        cy.zoom(1.4);
        cy.center();
      }
    }
  }

  function mostrarAvisoArvore(texto) {
    el.arvoreAviso.textContent = texto;
    el.arvoreAviso.hidden = false;
  }

  function esconderAvisoArvore() {
    el.arvoreAviso.hidden = true;
  }


  // -------------------------------------------------------------------
  // PARTE 5: eventos
  // -------------------------------------------------------------------

  el.exemplo.addEventListener("change", function () {
    usarAutomato(EXEMPLOS[Number(el.exemplo.value)].automato);
    esconderErro();
  });

  el.formSentenca.addEventListener("submit", function (evento) {
    evento.preventDefault();
    iniciarSimulacao(el.sentenca.value);
  });

  el.btnPasso.addEventListener("click", proximoPasso);
  el.btnTudo.addEventListener("click", executarTudo);
  el.btnReiniciar.addEventListener("click", reiniciar);
  el.btnCentralizar.addEventListener("click", centralizarArvore);

  // Disponível para o editor de autômatos.
  window.usarAutomato = usarAutomato;

  preencherExemplos();
  usarAutomato(EXEMPLOS[0].automato);
})();
