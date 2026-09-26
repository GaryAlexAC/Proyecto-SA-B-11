# Documentación de Bank USAC

La documentación se divide por tema. Los documentos de eventos, Saga, SRE, decisiones y despliegue fueron contrastados con la implementación actual; solo describen comportamiento verificable.

## Arquitectura

- [C4 - Contexto](architecture/c4-context.md)
- [C4 - Contenedores](architecture/c4-container.md)
- [C4 - Componentes](architecture/c4-component.md)
- [Despliegue implementado](architecture/deployment.md)

## UML

- [Casos de uso](uml/use-cases.md)
- [Secuencia: creación de cuenta](uml/sequence-create-account.md)
- [Secuencia: transferencia](uml/sequence-transfer.md)

## Dominio

- [Modelo de dominio](domain/domain-model.md)
- [Contextos delimitados](domain/bounded-contexts.md)

## Eventos y Saga

- [Catálogo de eventos](events/event-catalog.md)
- [Contratos de eventos](events/event-contracts.md)
- [Saga de transferencia](saga/transfer-saga.md)

## SRE

- [Service Level Indicators](sre/sli.md)
- [Service Level Objectives](sre/slo.md)
- [Service Level Agreement](sre/sla.md)

## Decisiones

- [Decisiones de arquitectura](decisions/architecture-decisions.md)
