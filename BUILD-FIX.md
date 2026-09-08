# V1.0.1 — correção de build Render

O build Linux do Render não encontrou `src/components/Navbar.tsx` no commit implantado.
Para eliminar problemas de case/caminho no Git, o componente foi convertido para:

`src/components/Navbar/index.tsx`

E o import do App passou a usar:

`./components/Navbar/index`

Os imports internos do componente foram ajustados para os caminhos corretos.

Validação estática: nenhum import relativo aponta para arquivo inexistente.

Observação: o ambiente de desenvolvimento desta entrega não conseguiu concluir `npm install` dentro do limite de execução, portanto o build Vite completo deve ser confirmado pelo Render/GitHub Actions.
