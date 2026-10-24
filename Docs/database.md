# Base de datos en VM

Las bases de datos no se ejecutan dentro de Kubernetes. PostgreSQL se aloja en
la VM de Compute Engine `bank-usac-db`, con dirección privada `10.10.16.2`,
dentro de la red privada de GCP.

## Bases lógicas

La instancia PostgreSQL mantiene una base lógica por servicio:

- `db_customer`
- `db_account`
- `db_transaction`
- `db_payment`
- `db_notification`

Cada microservicio utiliza su propio cliente Prisma y su propia variable
`DATABASE_URL`. Ningún servicio consulta directamente la base lógica de otro.

## Operación

La VM es creada por Terraform y las migraciones Prisma se ejecutan durante el
build o el despliegue del servicio correspondiente. El acceso desde GKE se
controla mediante la VPC y las reglas de firewall de GCP.

Para validar la conectividad y el estado del despliegue:

```bash
kubectl get pods -n dev
kubectl logs deployment/account-service -n dev
kubectl logs deployment/transaction-service -n dev
```

Las credenciales reales no forman parte de esta documentación.
