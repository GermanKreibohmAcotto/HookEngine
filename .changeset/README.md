# Changesets

Este directorio rastrea los incrementos de versión y las entradas de
changelog para `@hookengine/webhooks`, el único paquete de este monorepo que
se publica en npm — `apps/api` y `apps/web` son privados y quedan excluidos
vía `ignore` en [`config.json`](./config.json).

Corré `npm run changeset` después de hacer un cambio al SDK que los
consumidores deberían conocer, elegí un tipo de incremento
(patch/minor/major), y describí el cambio — ver
[CONTRIBUTING.md](../CONTRIBUTING.md#modificar-packageswebhooks) para la guía
completa de cuándo un cambio es patch, minor o major.

Documentación completa: https://github.com/changesets/changesets
