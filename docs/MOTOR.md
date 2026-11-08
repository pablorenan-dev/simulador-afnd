# Motor de simulação

O motor está em `js/motor.js` e não mexe no HTML. A tela chama as funções dele e
desenha o que ele devolve.

Para carregar na página:

```html
<script src="js/motor.js"></script>
```

Para rodar os testes: `node testes/testar-motor.js`

## Formato do autômato (João Pedro)

O editor e o arquivo `.json` precisam gerar exatamente este objeto:

```json
{
  "alfabeto": ["a", "b"],
  "estados": ["q0", "q1", "q2"],
  "estadoInicial": "q0",
  "estadosFinais": ["q2"],
  "transicoes": [
    { "origem": "q0", "simbolo": "a", "destinos": ["q0", "q1"] },
    { "origem": "q1", "simbolo": "ε", "destinos": ["q2"] }
  ]
}
```

- Cada linha de `transicoes` corresponde a uma célula da tabela.
- `destinos` é uma lista, e é isso que permite o não determinismo.
- Transição vazia usa o caractere `ε` em `simbolo` (constante `EPSILON` no motor).
- Cada símbolo do alfabeto tem **um caractere só**, e o `ε` não pode estar no alfabeto.

O motor **não valida o autômato**. A validação do editor precisa garantir que o estado
inicial, os estados finais, as origens e os destinos existem na lista de estados.

## Como executar (João Vitor)

```js
let simulacao;

try {
  simulacao = criarSimulacao(automato, "aab");
} catch (erro) {
  // sentença com símbolo fora do alfabeto: mostrar erro.message
}

desenhar(obterResumo(simulacao)); // estado inicial

// no clique do botão "Próximo passo":
avancarPasso(simulacao);
desenhar(obterResumo(simulacao));
```

`desenhar` é a função de vocês. Cada passo lê um símbolo e já segue as transições ε
que vierem depois dele.

## O que `obterResumo` devolve

| Campo | Conteúdo |
|---|---|
| `posicao` | quantos símbolos já foram lidos |
| `lido` | texto da parte já lida |
| `proximoSimbolo` | próximo símbolo, ou `null` se a entrada acabou |
| `restante` | texto da parte que falta (inclui o próximo símbolo) |
| `estadosPossiveis` | lista sem repetição, ex.: `["q0", "q1"]` |
| `ramosAtuais` | ramos do instante atual: `{ id, estado, situacao, caminho }` |
| `arvore` | todos os nós: `{ id, estado, idPai, simboloUsado, posicao, situacao }` |
| `terminou` | `true` quando acabou |
| `resultado` | `"ACEITA"`, `"REJEITADA"` ou `null` enquanto não acabou |

Para desenhar a árvore, cada item de `arvore` vira um nó, e cada item com `idPai`
diferente de `null` vira uma aresta do pai até ele, com o rótulo `simboloUsado`.

## Situações de um nó

| Situação | Significado |
|---|---|
| `ativo` | vai tentar ler o próximo símbolo |
| `expandido` | já gerou filhos, a execução segue por eles |
| `morto` | não tinha transição para o símbolo lido |
| `ciclo` | repetiria um estado na mesma sequência de ε, o ramo foi cortado |
| `aceito` | a entrada acabou em estado final |
| `rejeitado` | a entrada acabou em estado não final |

Um nó pode ser `ativo` e já ter filhos: quando ele tem transição ε, tanto ele quanto o
filho continuam podendo ler o próximo símbolo.

## Ainda não implementado

- Voltar um passo.
- Limite de nós na árvore.
