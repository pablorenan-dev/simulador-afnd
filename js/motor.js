// =====================================================================
// motor.js - Motor de simulação de AFND e AFND-ε
// =====================================================================
//
// COMO O NÃO DETERMINISMO FOI RESOLVIDO:
// A cada escolha não determinística, o motor cria um novo nó em uma ÁRVORE.
// Cada nó da árvore é uma "configuração" da máquina, ou seja:
//    "estou no estado X e já li N símbolos da entrada".
// Todos os ramos avançam juntos, um símbolo por passo.
//
// COMO USAR (resumo, o detalhe está em docs/MOTOR.md):
//    const simulacao = criarSimulacao(automato, "aab");
//    avancarPasso(simulacao);              // lê um símbolo
//    const resumo = obterResumo(simulacao); // dados para mostrar na tela
//
// Este arquivo não mexe na tela (HTML). Ele só faz as contas.
// =====================================================================


// Símbolo usado nas transições que não consomem entrada.
const EPSILON = "ε";

// Situações possíveis de um nó da árvore.
const SITUACAO = {
  ATIVO: "ativo",         // ainda vai tentar ler o próximo símbolo
  EXPANDIDO: "expandido", // já gerou filhos, quem continua são os filhos
  MORTO: "morto",         // não tinha transição para o símbolo lido
  CICLO: "ciclo",         // caiu em um ciclo de ε, o ramo foi cortado
  ACEITO: "aceito",       // a entrada acabou e o estado é final
  REJEITADO: "rejeitado"  // a entrada acabou e o estado não é final
};

// Resultados possíveis da simulação.
const RESULTADO_ACEITA = "ACEITA";
const RESULTADO_REJEITADA = "REJEITADA";


// ---------------------------------------------------------------------
// PARTE 1: consultas ao autômato
// ---------------------------------------------------------------------

// Devolve a lista de estados de destino para um par (estado, símbolo).
// Se não existir transição, devolve uma lista vazia.
function buscarDestinos(automato, estado, simbolo) {
  const destinos = [];

  for (let i = 0; i < automato.transicoes.length; i++) {
    const transicao = automato.transicoes[i];

    if (transicao.origem === estado && transicao.simbolo === simbolo) {
      for (let j = 0; j < transicao.destinos.length; j++) {
        const destino = transicao.destinos[j];

        // Evita destino repetido, senão apareceriam dois ramos iguais.
        if (!destinos.includes(destino)) {
          destinos.push(destino);
        }
      }
    }
  }

  return destinos;
}

// Diz se um estado faz parte da lista de estados finais.
function ehEstadoFinal(automato, estado) {
  return automato.estadosFinais.includes(estado);
}

// Procura caracteres da sentença que não estão no alfabeto.
// Devolve a lista dos caracteres inválidos (vazia = sentença válida).
function validarSentenca(automato, sentenca) {
  const invalidos = [];

  for (let i = 0; i < sentenca.length; i++) {
    const caractere = sentenca[i];

    if (!automato.alfabeto.includes(caractere) && !invalidos.includes(caractere)) {
      invalidos.push(caractere);
    }
  }

  return invalidos;
}


// ---------------------------------------------------------------------
// PARTE 2: árvore de ramos de execução
// ---------------------------------------------------------------------

// Cria um nó novo, liga ele no pai e guarda na lista geral de nós.
function criarNo(simulacao, estado, pai, simboloUsado) {
  const no = {
    id: simulacao.proximoId,
    estado: estado,
    pai: pai,                   // nó de onde veio (null na raiz)
    filhos: [],                 // nós gerados a partir deste
    simboloUsado: simboloUsado, // símbolo que levou até aqui (null na raiz)
    posicao: simulacao.posicao, // quantos símbolos já tinham sido lidos
    situacao: SITUACAO.ATIVO
  };

  simulacao.proximoId++;
  simulacao.nos.push(no);

  if (pai !== null) {
    pai.filhos.push(no);
  }

  return no;
}

// Devolve todos os nós que ainda vão tentar ler o próximo símbolo.
function pegarNosAtivos(simulacao) {
  const ativos = [];

  for (let i = 0; i < simulacao.nos.length; i++) {
    if (simulacao.nos[i].situacao === SITUACAO.ATIVO) {
      ativos.push(simulacao.nos[i]);
    }
  }

  return ativos;
}

// Diz se o nó tem algum filho que realmente continua a execução.
// Um filho marcado como CICLO não conta, porque ele foi cortado.
function temFilhosValidos(no) {
  for (let i = 0; i < no.filhos.length; i++) {
    if (no.filhos[i].situacao !== SITUACAO.CICLO) {
      return true;
    }
  }

  return false;
}

// Monta o texto do caminho da raiz até o nó. Exemplo: "q0 -a-> q1 -ε-> q2"
function montarCaminho(no) {
  let texto = no.estado;
  let atual = no;

  // Vai subindo pelos pais e colocando cada parte na frente do texto.
  while (atual.pai !== null) {
    texto = atual.pai.estado + " -" + atual.simboloUsado + "-> " + texto;
    atual = atual.pai;
  }

  return texto;
}


// ---------------------------------------------------------------------
// PARTE 3: transições ε e tratamento de ciclos
// ---------------------------------------------------------------------

// Verifica se o estado já apareceu na sequência de transições ε que
// chegou até este nó. Se apareceu, seguir por ele formaria um ciclo.
//
// Só olhamos a sequência ε atual: passar de novo pelo mesmo estado depois
// de ler um símbolo é normal e não é ciclo.
function formaCicloEpsilon(no, estado) {
  let atual = no;

  while (atual !== null) {
    if (atual.estado === estado) {
      return true;
    }

    // Se este nó não veio de uma transição ε, a sequência começa nele.
    if (atual.simboloUsado !== EPSILON) {
      return false;
    }

    atual = atual.pai;
  }

  return false;
}

// Cria os filhos de um nó seguindo as transições ε, e os filhos dos
// filhos, até não ter mais para onde ir (por isso é recursiva).
//
// A recursão sempre termina: cada chamada anda por um estado que ainda
// não está na sequência, e o número de estados é finito.
function expandirEpsilon(simulacao, no) {
  const destinos = buscarDestinos(simulacao.automato, no.estado, EPSILON);

  for (let i = 0; i < destinos.length; i++) {
    const destino = destinos[i];
    const ehCiclo = formaCicloEpsilon(no, destino);
    const filho = criarNo(simulacao, destino, no, EPSILON);

    if (ehCiclo) {
      // O nó fica na árvore para o usuário ver o ciclo, mas não continua.
      filho.situacao = SITUACAO.CICLO;
    } else {
      expandirEpsilon(simulacao, filho);
    }
  }
}


// ---------------------------------------------------------------------
// PARTE 4: controle da execução passo a passo
// ---------------------------------------------------------------------

// Prepara uma simulação nova, parada no início da sentença.
// Lança um erro se a sentença tiver caracteres fora do alfabeto.
function criarSimulacao(automato, sentenca) {
  const invalidos = validarSentenca(automato, sentenca);

  if (invalidos.length > 0) {
    throw new Error("Símbolos fora do alfabeto: " + invalidos.join(", "));
  }

  const simulacao = {
    automato: automato,
    entrada: sentenca.split(""), // cada caractere é um símbolo
    posicao: 0,                  // quantos símbolos já foram lidos
    nos: [],                     // todos os nós da árvore
    raiz: null,
    proximoId: 0,
    terminou: false,
    resultado: null              // ACEITA ou REJEITADA quando terminar
  };

  // A máquina pode andar pelas transições ε antes de ler qualquer símbolo.
  simulacao.raiz = criarNo(simulacao, automato.estadoInicial, null, null);
  expandirEpsilon(simulacao, simulacao.raiz);

  // A sentença pode ser vazia, e aí a simulação já acaba aqui.
  verificarFim(simulacao);

  return simulacao;
}

// Executa UM passo: todos os ramos ativos leem o próximo símbolo.
function avancarPasso(simulacao) {
  if (simulacao.terminou) {
    return;
  }

  // Guarda os ativos ANTES de criar filhos, pois os filhos também nascem
  // ativos e só devem ler o símbolo no próximo passo.
  const ativos = pegarNosAtivos(simulacao);
  const simbolo = simulacao.entrada[simulacao.posicao];

  simulacao.posicao++;

  for (let i = 0; i < ativos.length; i++) {
    const no = ativos[i];
    const destinos = buscarDestinos(simulacao.automato, no.estado, simbolo);

    // Mais de um destino aqui é justamente a escolha não determinística.
    for (let j = 0; j < destinos.length; j++) {
      const filho = criarNo(simulacao, destinos[j], no, simbolo);
      expandirEpsilon(simulacao, filho);
    }

    // Um nó pode não ler o símbolo e mesmo assim ter filhos por ε.
    // Nesse caso ele não morreu, a execução continua pelos filhos.
    if (temFilhosValidos(no)) {
      no.situacao = SITUACAO.EXPANDIDO;
    } else {
      no.situacao = SITUACAO.MORTO;
    }
  }

  verificarFim(simulacao);
}

// Confere se a simulação acabou e, se acabou, define o resultado.
function verificarFim(simulacao) {
  const ativos = pegarNosAtivos(simulacao);

  // Todos os ramos morreram antes do fim da entrada.
  if (ativos.length === 0) {
    simulacao.terminou = true;
    simulacao.resultado = RESULTADO_REJEITADA;
    return;
  }

  // Ainda tem entrada para ler.
  if (simulacao.posicao < simulacao.entrada.length) {
    return;
  }

  // A entrada acabou: basta UM ramo em estado final para aceitar.
  let algumAceito = false;

  for (let i = 0; i < ativos.length; i++) {
    const no = ativos[i];

    if (ehEstadoFinal(simulacao.automato, no.estado)) {
      no.situacao = SITUACAO.ACEITO;
      algumAceito = true;
    } else if (temFilhosValidos(no)) {
      no.situacao = SITUACAO.EXPANDIDO; // quem decide são os filhos
    } else {
      no.situacao = SITUACAO.REJEITADO;
    }
  }

  simulacao.terminou = true;

  if (algumAceito) {
    simulacao.resultado = RESULTADO_ACEITA;
  } else {
    simulacao.resultado = RESULTADO_REJEITADA;
  }
}


// ---------------------------------------------------------------------
// PARTE 5: dados para a interface
// ---------------------------------------------------------------------

// Devolve tudo que a tela precisa mostrar no instante atual.
// Os nós saem em uma lista simples (com idPai no lugar das referências),
// o que facilita desenhar no Cytoscape.
function obterResumo(simulacao) {
  const estadosPossiveis = [];
  const ramosAtuais = [];
  const arvore = [];

  for (let i = 0; i < simulacao.nos.length; i++) {
    const no = simulacao.nos[i];

    // A árvore inteira vai para a tela.
    let idPai = null;
    if (no.pai !== null) {
      idPai = no.pai.id;
    }

    arvore.push({
      id: no.id,
      estado: no.estado,
      idPai: idPai,
      simboloUsado: no.simboloUsado,
      posicao: no.posicao,
      situacao: no.situacao
    });

    // Os ramos atuais são os nós criados depois do último símbolo lido.
    if (no.posicao === simulacao.posicao) {
      ramosAtuais.push({
        id: no.id,
        estado: no.estado,
        situacao: no.situacao,
        caminho: montarCaminho(no)
      });

      if (!estadosPossiveis.includes(no.estado)) {
        estadosPossiveis.push(no.estado);
      }
    }
  }

  // Símbolo que será lido no próximo passo (null se a entrada acabou).
  let proximoSimbolo = null;
  if (simulacao.posicao < simulacao.entrada.length) {
    proximoSimbolo = simulacao.entrada[simulacao.posicao];
  }

  return {
    posicao: simulacao.posicao,
    lido: simulacao.entrada.slice(0, simulacao.posicao).join(""),
    proximoSimbolo: proximoSimbolo,
    restante: simulacao.entrada.slice(simulacao.posicao).join(""),
    estadosPossiveis: estadosPossiveis,
    ramosAtuais: ramosAtuais,
    arvore: arvore,
    terminou: simulacao.terminou,
    resultado: simulacao.resultado
  };
}


// ---------------------------------------------------------------------
// O QUE AINDA FALTA NO MOTOR
// ---------------------------------------------------------------------
// TODO (Pablo): voltarPasso(simulacao). Dá para criar a simulação de novo
//               e repetir avancarPasso até a posição anterior.
// TODO (Pablo): limite de nós na árvore. Ela pode crescer muito em
//               autômatos muito não determinísticos e travar o navegador.


// No navegador este arquivo entra com <script src="js/motor.js"></script>
// e as funções ficam disponíveis direto. Esta parte só serve para o Node
// conseguir importar o motor nos testes.
if (typeof module !== "undefined") {
  module.exports = {
    EPSILON,
    SITUACAO,
    RESULTADO_ACEITA,
    RESULTADO_REJEITADA,
    buscarDestinos,
    validarSentenca,
    criarSimulacao,
    avancarPasso,
    obterResumo
  };
}
