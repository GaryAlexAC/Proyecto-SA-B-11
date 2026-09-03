async function runSagaTest() {
  const GATEWAY_URL = 'http://localhost:3000/api';

  try {
    console.log('===================================================');
    console.log('🚀 INICIANDO PRUEBA DE SAGA DE TRANSFERENCIAS 🚀');
    console.log('===================================================\n');

    // 1. Crear Cuenta Origen
    console.log('1️⃣ Creando cuenta de origen (Andrés) con Q. 5000...');
    let res = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 'cust-andres-01', type: 'MONETARIA', balance: 5000.00 })
    });
    const sourceAccount = await res.json();
    console.log(`✅ Cuenta origen creada: ID = ${sourceAccount.id}\n`);

    // 2. Crear Cuenta Destino
    console.log('2️⃣ Creando cuenta destino (USAC) con Q. 0...');
    res = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 'cust-usac-02', type: 'MONETARIA', balance: 0.00 })
    });
    const targetAccount = await res.json();
    console.log(`✅ Cuenta destino creada: ID = ${targetAccount.id}\n`);

    // 3. Ejecutar Transferencia
    console.log(`3️⃣ Ejecutando transferencia de Q. 1500 desde Andrés hacia la USAC...`);
    console.log(`📡 ¡Esto dispara la Saga a través de RabbitMQ!`);
    res = await fetch(`${GATEWAY_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceAccount: sourceAccount.id,
        targetAccount: targetAccount.id,
        amount: 1500.00
      })
    });
    const transaction = await res.json();
    console.log(`✅ Transacción registrada con ID = ${transaction.id} | Estado Inicial = ${transaction.status}\n`);

    // Esperar unos segundos para que la cola procese
    console.log('⏳ Esperando 2 segundos para que los microservicios procesen la cola asíncrona...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verificar Saldos
    console.log('\n4️⃣ Verificando saldos finales...');
    
    res = await fetch(`${GATEWAY_URL}/accounts/${sourceAccount.id}/balance`);
    const finalSource = await res.json();
    console.log(`💰 Saldo final Andrés: Q. ${finalSource.balance} (Esperado: 3500)`);

    res = await fetch(`${GATEWAY_URL}/accounts/${targetAccount.id}/balance`);
    const finalTarget = await res.json();
    console.log(`🏦 Saldo final USAC: Q. ${finalTarget.balance} (Esperado: 1500)\n`);

    console.log('===================================================');
    console.log('✨ PRUEBA COMPLETADA EXITOSAMENTE ✨');
    console.log('===================================================');

  } catch (error) {
    console.error('❌ Hubo un error ejecutando la prueba:', error.message);
  }
}

runSagaTest();
