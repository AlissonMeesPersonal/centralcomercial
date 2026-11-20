# Padrão de código — Central Comercial 26Fit

A aplicação usa **Prettier 3.6.2** para aplicar o mesmo padrão em todas as pastas
de código: `app/`, `components/`, `lib/`, `data/`, configurações e workflows.

## Formatação

- Indentação: 2 espaços; fim de linha LF.
- Linhas: 100 caracteres de preferência.
- Aspas duplas, ponto e vírgula e vírgula final.
- JSX e CSS são formatados pelo parser correspondente.
- Imagens e arquivos gerados são mantidos inalterados.

Para formatar localmente:

```bash
npx --yes prettier@3.6.2 --write . --ignore-path .prettierignore
```

Para apenas verificar:

```bash
npx --yes prettier@3.6.2 --check . --ignore-path .prettierignore
```

O workflow `.github/workflows/format-code.yml` aplica o formato,
executa `npm run build` e só publica a alteração se o build concluir.
Esse processo não busca alterar regras de autenticação, comerciais,
permissões, contratos de API ou consultas de banco.
