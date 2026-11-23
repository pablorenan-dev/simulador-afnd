// Testes da especificação do autômato (editor, validação e JSON).
// Para rodar, na pasta do projeto: node testes/testar-especificacao.js

const esp = require("../js/especificacao.js");
const motor = require("../js/motor.js");

let aprovados = 0;
let reprovados = 0;

function conferir(descricao, obtido, esperado) {
  if (obtido === esperado) {
    aprovados++;
    console.log("  ok    " + descricao);
  } else {
    reprovados++;
    console.log("  ERRO  " + descricao + " (esperado: " + esperado + ", obtido: " + obtido + ")");
  }
}

// Confere que o autômato é recusado e que alguma mensagem cita o trecho.
function conferirRecusado(descricao, automato, trecho) {
  const erros = esp.validarAutomato(automato);
  const citou = erros.some(function (erro) { return erro.includes(trecho); });
  conferir(descricao, erros.length > 0 && citou, true);
  if (!citou) {
    console.log("        mensagens: " + JSON.stringify(erros));
  }
}

// Copia o autômato base e aplica uma alteração nele.
function variar(alteracao) {
  const copia = JSON.parse(JSON.stringify(base));
  alteracao(copia);
  return copia;
}

function executarTudo(automato, sentenca) {
  const simulacao = motor.criarSimulacao(automato, sentenca);
  while (!simulacao.terminou) {
    motor.avancarPasso(simulacao);
  }
  return simulacao.resultado;
}

// AFND-ε de docs/MOTOR.md, usado como base para as variações.
const base = {
  alfabeto: ["a", "b"],
  estados: ["q0", "q1", "q2"],
  estadoInicial: "q0",
  estadosFinais: ["q2"],
  transicoes: [
    { origem: "q0", simbolo: "a", destinos: ["q0", "q1"] },
    { origem: "q1", simbolo: "ε", destinos: ["q2"] }
  ]
};


console.log("Leitura dos campos");
conferir("separa por espaço e vírgula", esp.separarLista(" q0, q1  q2;q3 ").join("|"), "q0|q1|q2|q3");
conferir("texto vazio vira lista vazia", esp.separarLista("   ").length, 0);
conferir("& vira ε", esp.normalizarSimbolo("&", ["a"]), "ε");
conferir("λ vira ε", esp.normalizarSimbolo("λ", ["a"]), "ε");
conferir("a letra e continua e", esp.normalizarSimbolo("e", ["e"]), "e");
conferir("& do alfabeto não vira ε", esp.normalizarSimbolo("&", ["&"]), "&");


console.log("\nMontagem pelo editor (tabela)");
const montado = esp.montarAutomato({
  alfabeto: ["a", "b"],
  estados: ["q0", "q1", "q2"],
  estadoInicial: "q0",
  estadosFinais: ["q2"],
  celulas: [
    { origem: "q0", simbolo: "a", texto: "q0, q1, q0" },
    { origem: "q0", simbolo: "b", texto: "" },
    { origem: "q0", simbolo: "ε", texto: "   " },
    { origem: "q1", simbolo: "ε", texto: "q2" }
  ]
});
conferir("célula vazia não vira transição", montado.transicoes.length, 2);
conferir("vários destinos e sem repetição", montado.transicoes[0].destinos.join(","), "q0,q1");
conferir("transição ε usa o caractere do motor", montado.transicoes[1].simbolo, motor.EPSILON);
conferir("só os 5 campos do formato", Object.keys(montado).join(","),
  "alfabeto,estados,estadoInicial,estadosFinais,transicoes");
conferir("gera o mesmo objeto de docs/MOTOR.md", JSON.stringify(montado), JSON.stringify(base));
conferir("o autômato montado é válido", esp.validarAutomato(montado).length, 0);
conferir("o motor aceita \"a\"", executarTudo(montado, "a"), motor.RESULTADO_ACEITA);
conferir("o motor rejeita \"b\"", executarTudo(montado, "b"), motor.RESULTADO_REJEITADA);


console.log("\nEstrutura");
conferirRecusado("não é objeto", [], "objeto");
conferirRecusado("sem o campo transicoes", variar(function (a) { delete a.transicoes; }), "transicoes");
conferirRecusado("destinos não é lista", variar(function (a) { a.transicoes[0].destinos = "q1"; }), "destinos");
conferirRecusado("estadoInicial não é texto", variar(function (a) { a.estadoInicial = 0; }), "estadoInicial");


console.log("\nAlfabeto");
conferirRecusado("alfabeto vazio", variar(function (a) { a.alfabeto = []; }), "vazio");
conferirRecusado("símbolo com 2 caracteres", variar(function (a) { a.alfabeto.push("ab"); }), "mais de um caractere");
conferirRecusado("ε no alfabeto", variar(function (a) { a.alfabeto.push("ε"); }), "ε não pode");
conferirRecusado("símbolo em branco", variar(function (a) { a.alfabeto.push(" "); }), "em branco");
conferirRecusado("símbolo repetido", variar(function (a) { a.alfabeto.push("a"); }), "repetido");
conferir("repetição acusada uma vez só",
  esp.validarAutomato(variar(function (a) { a.alfabeto = ["a", "a", "a", "b"]; })).length, 1);


console.log("\nEstados, inicial e finais");
conferirRecusado("nenhum estado", variar(function (a) { a.estados = []; }), "Nenhum estado");
conferirRecusado("estado repetido", variar(function (a) { a.estados.push("q1"); }), "repetido");
conferirRecusado("estado com espaço", variar(function (a) { a.estados.push("q 3"); }), "espaço");
conferirRecusado("inicial não escolhido", variar(function (a) { a.estadoInicial = ""; }), "Escolha");
conferirRecusado("inicial inexistente", variar(function (a) { a.estadoInicial = "q9"; }), "q9");
conferirRecusado("final inexistente", variar(function (a) { a.estadosFinais.push("q9"); }), "q9");
conferir("sem estados finais é permitido",
  esp.validarAutomato(variar(function (a) { a.estadosFinais = []; })).length, 0);


console.log("\nTransições");
conferirRecusado("origem inexistente", variar(function (a) { a.transicoes[0].origem = "q9"; }), "origem");
conferirRecusado("símbolo fora do alfabeto", variar(function (a) { a.transicoes[0].simbolo = "c"; }), "não está no alfabeto");
conferirRecusado("destino inexistente", variar(function (a) { a.transicoes[0].destinos.push("q9"); }), "δ(q0, a)");
conferirRecusado("sem destinos", variar(function (a) { a.transicoes[0].destinos = []; }), "nenhum estado de destino");


console.log("\nNormalização (arquivo aberto)");
const bagunçado = {
  alfabeto: [" a", "b"],
  estados: ["q0 ", "q1", "q2"],
  estadoInicial: " q0",
  estadosFinais: ["q2"],
  extra: "ignorado",
  transicoes: [
    { origem: "q0", simbolo: "a", destinos: ["q0"] },
    { origem: "q0", simbolo: "a", destinos: ["q1", "q0"] },
    { origem: "q1", simbolo: "&", destinos: ["q2"] }
  ]
};
const normalizado = esp.normalizarAutomato(bagunçado);
conferir("une linhas repetidas e tira espaços", JSON.stringify(normalizado), JSON.stringify(base));
conferir("o normalizado é válido", esp.validarAutomato(normalizado).length, 0);


console.log("\nSalvar e abrir JSON");
const texto = esp.gerarTextoJSON(base);
const reaberto = esp.lerTextoJSON(texto);
conferir("salvar e abrir devolve o mesmo autômato", JSON.stringify(reaberto.automato), JSON.stringify(base));
conferir("o JSON salvo tem só os 5 campos",
  Object.keys(JSON.parse(esp.gerarTextoJSON(Object.assign({ extra: 1 }, base)))).length, 5);
conferir("JSON quebrado é recusado", esp.lerTextoJSON("{ alfabeto: ").erros[0].includes("não é um JSON válido"), true);
conferir("JSON sem campos é recusado", esp.lerTextoJSON("{}").erros.length > 0, true);
conferir("JSON com estado inexistente é recusado",
  esp.lerTextoJSON(JSON.stringify(variar(function (a) { a.estadoInicial = "q9"; }))).automato, null);
conferir("JSON com \"&\" no lugar de ε é aceito",
  esp.lerTextoJSON(JSON.stringify(bagunçado)).erros.length, 0);


// Abre um exemplo da pasta exemplos/ do mesmo jeito que o botão Abrir.
function abrirExemplo(nome) {
  const caminho = require("path").join(__dirname, "..", "exemplos", nome);
  const lido = esp.lerTextoJSON(require("fs").readFileSync(caminho, "utf-8"));
  conferir(nome + " abre sem erros", lido.erros.length, 0);
  if (lido.erros.length > 0) {
    console.log("        mensagens: " + JSON.stringify(lido.erros));
  }
  return lido.automato;
}

function conferirSentencas(automato, sentencas, esperado) {
  for (let i = 0; i < sentencas.length; i++) {
    conferir('"' + sentencas[i] + '" deve ser ' + esperado,
      executarTudo(automato, sentencas[i]), esperado);
  }
}

console.log("\nExemplo: números reais (exemplos/numeros-reais.json)");
const reais = abrirExemplo("numeros-reais.json");
if (reais !== null) {
  conferirSentencas(reais,
    ["0", "3", "42", "-3", "+7", "3.14", "-0.5", "+2e10", "1.5E-3", "6e+23", "-9.81e0"],
    motor.RESULTADO_ACEITA);
  conferirSentencas(reais,
    ["", "+", "-", "3.", ".5", "1e", "1e+", "+-1", "1.2.3", "e5", "1e2.5", "--1", "1E2E3"],
    motor.RESULTADO_REJEITADA);
}

console.log("\nExemplo: palavras-chave (exemplos/palavras-chave.json)");
const chaves = abrirExemplo("palavras-chave.json");
if (chaves !== null) {
  conferirSentencas(chaves,
    ["if", "int", "for", "float", "while", "else", "return"],
    motor.RESULTADO_ACEITA);
  conferirSentencas(chaves,
    ["", "i", "in", "iff", "fo", "floats", "retur", "elsee", "whilee", "abc", "fi"],
    motor.RESULTADO_REJEITADA);
}


console.log("\nAprovados: " + aprovados + "  Reprovados: " + reprovados);

if (reprovados > 0) {
  process.exit(1);
}
