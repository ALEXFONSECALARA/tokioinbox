# Recuperação da senha do administrador

A recuperação do usuário `admin` foi corrigida sem criar senha fixa ou bypass público.

1. No Render, configure a variável de ambiente `ADMIN_PASSWORD` com uma senha forte de pelo menos 8 caracteres.
2. Faça um novo deploy/restart. O servidor sincroniza o hash do usuário `admin` com essa senha e reativa o usuário caso esteja inativo.
3. Se necessário, o endpoint `POST /api/auth/admin-reset` força a redefinição usando exclusivamente `ADMIN_PASSWORD` e encerra todas as sessões anteriores.

Não coloque a senha real no Git, no ZIP ou no `.env.example`.
