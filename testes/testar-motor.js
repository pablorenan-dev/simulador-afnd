// Testes do motor de simulação.
// Para rodar, na pasta do projeto: node testes/testar-motor.js

const motor = require("../js/motor.js");

let aprovados = 0;
let reprovados = 0;

// Compara o valor obtido com o esperado e mostra o resultado na tela.
function conferir(descricao, obtido, esperado) {
  if (obtido === esperado) {
    aprovados++;
    console.log("  ok    " + descricao);
  } else {
    reprovados++;
    console.log("  ERRO  " + descricao + " (esperado: " + esperado + ", obtido: " + obtido + ")");
  }
}

// Executa a sentença inteira e devolve a simulação já terminada.
function executarTudo(automato, sentenca) {
  const simulacao = motor.criarSimulacao(automato, sentenca);

  while (!simulacao.terminou) {
    motor.avancarPasso(simulacao);
  }

  return simulacao;
}

// Atalho para conferir se uma sentença é aceita ou rejeitada.
function conferirSentenca(automato, sentenca, esperado) {
  const simulacao = executarTudo(automato, sentenca);
  conferir('"' + sentenca + '" deve ser ' + esperado, simulacao.resultado, esperado);
}

// Conta quantos nós da simulação estão em uma situação.
function contarSituacao(simulacao, situacao) {
  let total = 0;

  for (let i = 0; i < simulacao.nos.length; i++) {
    if (simulacao.nos[i].situacao === situacao) {
      total++;
    }
  }

  return total;
}

// Mostra na tela a execução passo a passo de uma sentença.
function mostrarExecucao(automato, sentenca) {
  const simulacao = motor.criarSimulacao(automato, sentenca);
  console.log('\nExecução de "' + sentenca + '":');

  while (true) {
    const resumo = motor.obterResumo(simulacao);
    console.log("  lido: [" + resumo.lido + "]  restante: [" + resumo.restante + "]");
    console.log("  estados possíveis: {" + resumo.estadosPossiveis.join(", ") + "}");

    for (let i = 0; i < resumo.ramosAtuais.length; i++) {
      const ramo = resumo.ramosAtuais[i];
      console.log("    " + ramo.caminho + "  (" + ramo.situacao + ")");
    }

    if (resumo.terminou) {
      console.log("  RESULTADO: " + resumo.resultado);
      break;
    }

    motor.avancarPasso(simulacao);
  }
}


// ---------------------------------------------------------------------
// Autômatos usados nos testes
// ---------------------------------------------------------------------

// AFND: palavras sobre {a, b} que terminam em "abb".
const terminaEmAbb = {
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
};

// AFND-ε: zero ou mais "a" seguidos de zero ou mais "b".
const asDepoisBs = {
  alfabeto: ["a", "b"],
  estados: ["q0", "q1"],
  estadoInicial: "q0",
  estadosFinais: ["q1"],
  transicoes: [
    { origem: "q0", simbolo: "a", destinos: ["q0"] },
    { origem: "q0", simbolo: "ε", destinos: ["q1"] },
    { origem: "q1", simbolo: "b", destinos: ["q1"] }
  ]
};

// AFND-ε com ciclo: q0 -ε-> q1 -ε-> q0, e q1 ainda tem laço ε nele mesmo.
const comCicloEpsilon = {
  alfabeto: ["a"],
  estados: ["q0", "q1", "q2"],
  estadoInicial: "q0",
  estadosFinais: ["q2"],
  transicoes: [
    { origem: "q0", simbolo: "ε", destinos: ["q1"] },
    { origem: "q1", simbolo: "ε", destinos: ["q0", "q1"] },
    { origem: "q1", simbolo: "a", destinos: ["q2"] }
  ]
};

// O mesmo par (estado, símbolo) aparece em duas linhas e com destino repetido.
const comTransicaoRepetida = {
  alfabeto: ["a"],
  estados: ["q0", "q1", "q2"],
  estadoInicial: "q0",
  estadosFinais: ["q2"],
  transicoes: [
    { origem: "q0", simbolo: "a", destinos: ["q1", "q1"] },
    { origem: "q0", simbolo: "a", destinos: ["q1", "q2"] }
  ]
};


// ---------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------

console.log("AFND (termina em abb)");
conferirSentenca(terminaEmAbb, "abb", motor.RESULTADO_ACEITA);
conferirSentenca(terminaEmAbb, "aababb", motor.RESULTADO_ACEITA);
conferirSentenca(terminaEmAbb, "abba", motor.RESULTADO_REJEITADA);
conferirSentenca(terminaEmAbb, "", motor.RESULTADO_REJEITADA);

console.log("\nAFND-ε (a* b*)");
conferirSentenca(asDepoisBs, "", motor.RESULTADO_ACEITA);
conferirSentenca(asDepoisBs, "aabb", motor.RESULTADO_ACEITA);
conferirSentenca(asDepoisBs, "ba", motor.RESULTADO_REJEITADA);

console.log("\nCiclos de ε");
conferirSentenca(comCicloEpsilon, "a", motor.RESULTADO_ACEITA);
conferirSentenca(comCicloEpsilon, "", motor.RESULTADO_REJEITADA);
conferirSentenca(comCicloEpsilon, "aa", motor.RESULTADO_REJEITADA);
conferir(
  "os ciclos ficam marcados na árvore",
  contarSituacao(executarTudo(comCicloEpsilon, "a"), motor.SITUACAO.CICLO) > 0,
  true
);

console.log("\nTransições repetidas");
conferir(
  "destinos repetidos são unidos",
  motor.buscarDestinos(comTransicaoRepetida, "q0", "a").join(","),
  "q1,q2"
);

console.log("\nFim antecipado (todos os ramos morrem)");
const simulacaoMorta = motor.criarSimulacao(asDepoisBs, "bab");
motor.avancarPasso(simulacaoMorta);
conferir("depois do b ainda não terminou", simulacaoMorta.terminou, false);
motor.avancarPasso(simulacaoMorta);
conferir("depois do a já terminou", simulacaoMorta.terminou, true);
conferir("o resultado é REJEITADA", simulacaoMorta.resultado, motor.RESULTADO_REJEITADA);
conferir("sobrou entrada sem ler", motor.obterResumo(simulacaoMorta).restante, "b");

console.log("\nResumo para a interface");
const resumoInicial = motor.obterResumo(motor.criarSimulacao(asDepoisBs, "ab"));
conferir("estados possíveis no início", resumoInicial.estadosPossiveis.join(","), "q0,q1");
conferir("restante no início", resumoInicial.restante, "ab");
conferir("próximo símbolo", resumoInicial.proximoSimbolo, "a");

console.log("\nSentenças inválidas");
function erroAoCriar(automato, sentenca) {
  try {
    motor.criarSimulacao(automato, sentenca);
    return false;
  } catch (erro) {
    return true;
  }
}
conferir("símbolo fora do alfabeto dá erro", erroAoCriar(asDepoisBs, "abc"), true);
conferir("o próprio ε na sentença dá erro", erroAoCriar(asDepoisBs, "aε"), true);

mostrarExecucao(terminaEmAbb, "aabb");
mostrarExecucao(asDepoisBs, "ab");

console.log("\nAprovados: " + aprovados + "  Reprovados: " + reprovados);

if (reprovados > 0) {
  process.exit(1);
}
