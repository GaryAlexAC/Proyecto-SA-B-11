const { execSync } = require('child_process');

async function runFase2Test() {
  const GATEWAY_URL = 'http://localhost:3000/api';

  try {
    console.log('===================================================');
    console.log('🚀 INICIANDO PRUEBA DE REGLAS DE NEGOCIO - FASE 2 🚀');
    console.log('===================================================\n');

        console.log('🔧 Preparando datos en Base de Datos (Clientes y Servicios)...');
        try {
            execSync(`docker exec bank_usac_postgres psql -U admin -d db_customer -c "INSERT INTO \\"Customer\\" (id, \\"fullName\\", document, email, \\"birthDate\\", address, username, \\"passwordHash\\", role, status, \\"kycStatus\\", \\"createdAt\\", \\"updatedAt\\", \\"activatedAt\\") VALUES ('cust-fase2-01', 'Test 1', 'DOC-1', 't1@t.com', '1990-01-01', 'addr', 'test1', 'hash', 'CLIENT', 'ACTIVE', 'VERIFIED', NOW(), NOW(), NOW()) ON CONFLICT DO NOTHING;"`);
            execSync(`docker exec bank_usac_postgres psql -U admin -d db_customer -c "INSERT INTO \\"Customer\\" (id, \\"fullName\\", document, email, \\"birthDate\\", address, username, \\"passwordHash\\", role, status, \\"kycStatus\\", \\"createdAt\\", \\"updatedAt\\", \\"activatedAt\\") VALUES ('cust-fase2-02', 'Test 2', 'DOC-2', 't2@t.com', '1990-01-01', 'addr2', 'test2', 'hash', 'CLIENT', 'ACTIVE', 'VERIFIED', NOW(), NOW(), NOW()) ON CONFLICT DO NOTHING;"`);
            execSync(`docker exec bank_usac_postgres psql -U admin -d db_customer -c "UPDATE \\"Customer\\" SET \\"kycStatus\\" = 'VERIFIED' WHERE id IN ('cust-fase2-01', 'cust-fase2-02');"`);
            execSync(`docker exec bank_usac_postgres psql -U admin -d db_payment -c "INSERT INTO \\"Company\\" (id, name, \\"createdAt\\", \\"updatedAt\\") VALUES ('comp-1', 'Compania Electrica', NOW(), NOW()) ON CONFLICT DO NOTHING;"`);
            execSync(`docker exec bank_usac_postgres psql -U admin -d db_payment -c "INSERT INTO \\"Service\\" (id, \\"companyId\\", name, amount, \\"createdAt\\", \\"updatedAt\\") VALUES ('serv-1', 'comp-1', 'Luz - EEGSA', 150.00, NOW(), NOW()) ON CONFLICT DO NOTHING;"`);
        } catch (e) {
        console.log('⚠️ Error preparando datos:', e.message);
    }

    const loginRes = await fetch(`${GATEWAY_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'ChangeMe123' })
    });
    const loginData = await loginRes.json();
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.access_token || loginData.accessToken}`
    };

    // 1. Probar Cuenta de Ahorro (Saldo mínimo y comisión)
    console.log('1️⃣ Creando cuenta de AHORRO con Q. 300...');
    let res = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customerId: 'cust-fase2-01', type: 'AHORRO', balance: 300.00 })
    });
    const ahorroAccount = await res.json();
    console.log(`✅ Cuenta de AHORRO creada:`, ahorroAccount, `\n`);

    console.log('2️⃣ Creando cuenta destino MONETARIA...');
    res = await fetch(`${GATEWAY_URL}/accounts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customerId: 'cust-fase2-02', type: 'MONETARIA', balance: 0.00 })
    });
    const monetariaAccount = await res.json();
    console.log(`✅ Cuenta MONETARIA creada:`, monetariaAccount, `\n`);

    console.log(`3️⃣ Intentando transferir Q. 96 desde la cuenta AHORRO...`);
    console.log(`   (Monto: 96 + Comisión: 5 = Total a descontar: 101. Quedarían 199 de saldo)`);
    console.log(`   ⚠️ Como el saldo mínimo de AHORRO es Q.200, esto DEBERÍA FALLAR por regla de negocio.`);
    
    res = await fetch(`${GATEWAY_URL}/transactions`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': `test-tx-${Date.now()}` },
      body: JSON.stringify({
        sourceAccount: ahorroAccount.id,
        targetAccount: monetariaAccount.id,
        amount: 96.00,
        customerId: 'cust-fase2-01'
      })
    });
    const txAhorro = await res.json();
    console.log(`Respuesta de creación de transacción:`, txAhorro);
    console.log(`✅ Transacción registrada: ID = ${txAhorro.id}. Esperando resolución de la Saga...`);

    await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar Saga
    
    res = await fetch(`${GATEWAY_URL}/transactions/${txAhorro.id}`, { headers });
    const txAhorroFinal = await res.json();
    console.log(`📝 Estado final de la transacción: ${txAhorroFinal.status}`);
    console.log(`💥 Razón del fallo: ${txAhorroFinal.failReason} (Esperado: MinimumBalanceViolated)\n`);

    console.log('===================================================');
    console.log('🚀 INICIANDO PRUEBA DE PAGOS EXTERNOS (SIMULACIÓN) 🚀');
    console.log('===================================================\n');

    console.log('Obteniendo lista de servicios externos...');
    res = await fetch(`${GATEWAY_URL}/payments/services`, { headers });
    let services = await res.json();
    if (services.statusCode) {
       console.log('Error obteniendo servicios:', services);
       return;
    }
    if (!Array.isArray(services)) {
        services = services.data || Object.values(services);
    }
    
    if (!services || services.length === 0) {
        console.log('⚠️ No hay servicios externos creados. Asegúrate de ejecutar el seed en la BD.');
    } else {
        const testService = services[0];
        console.log(`Servicio seleccionado: ${testService?.name} (Q. ${testService?.amount})`);
        
        console.log('Vamos a disparar 5 intentos rápidos de pago para observar la aleatoriedad (70% Éxito, 20% Rechazo, 10% Timeout)...');
        
        for (let i = 1; i <= 5; i++) {
            res = await fetch(`${GATEWAY_URL}/payments`, {
                method: 'POST',
                headers: { ...headers, 'Idempotency-Key': `pago-test-random-${Date.now()}-${i}` },
                body: JSON.stringify({
                  sourceAccountId: monetariaAccount.id, // Origen
                  serviceId: testService.id,
                  customerId: 'cust-fase2-02',
                  initiatedBy: 'cust-fase2-02'
                })
            });
            const pmt = await res.json();
            console.log(`[Intento ${i}] Estado Inmediato: ${pmt.status} | FailReason: ${pmt.failReason || 'Ninguna (Avanza a Saga)'}`);
        }
    }

    console.log('\n===================================================');
    console.log('✨ PRUEBAS DE FASE 2 COMPLETADAS ✨');
    console.log('===================================================');

  } catch (error) {
    console.error('❌ Hubo un error ejecutando la prueba:', error.message);
  }
}

runFase2Test();
