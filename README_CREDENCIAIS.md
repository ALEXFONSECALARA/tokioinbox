# Credenciais iniciais do painel

- URL: `/painelrestaurante`
- Usuário inicial: `admin`
- Senha inicial: `admin`

## Trocar a senha

Depois de entrar, abra **Equipe > Usuários**, selecione o usuário `admin` e informe uma nova senha.

A senha alterada é armazenada como hash no servidor e permanece após reinicializações.

## Render

Se a variável `ADMIN_PASSWORD` estiver configurada, ela terá prioridade **somente quando a base de usuários ainda não existir**. Para uma instalação nova, pode usar `ADMIN_PASSWORD=admin` ou deixar a variável ausente para utilizar `admin/admin`.

> Segurança: troque `admin` por uma senha forte imediatamente após o primeiro acesso.
