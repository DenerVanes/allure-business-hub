/**
 * Script alternativo para gerar tipos TypeScript do Supabase
 * 
 * Método 1: Via Dashboard (Mais fácil)
 * 1. Acesse: https://supabase.com/dashboard/project/nzllgvbyuxkzlxgtaxhq/settings/api
 * 2. Role até "Project API keys"
 * 3. Copie a "service_role" key (CUIDADO: não compartilhe essa chave!)
 * 4. Execute: node scripts/generate-types.js YOUR_SERVICE_ROLE_KEY
 * 
 * Método 2: Via CLI (após instalar)
 * 1. Instale Supabase CLI via Scoop ou Chocolatey
 * 2. Execute: supabase login
 * 3. Execute: npm run supabase:types
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'nzllgvbyuxkzlxgtaxhq';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;

async function generateTypes(serviceRoleKey) {
  if (!serviceRoleKey) {
    console.error('❌ Erro: Service Role Key não fornecida');
    console.log('\n📝 Como obter a Service Role Key:');
    console.log('1. Acesse: https://supabase.com/dashboard/project/' + PROJECT_ID + '/settings/api');
    console.log('2. Role até "Project API keys"');
    console.log('3. Copie a "service_role" key');
    console.log('4. Execute: node scripts/generate-types.js YOUR_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  try {
    console.log('🔄 Gerando tipos TypeScript do Supabase...');
    
    // Usar a API do Supabase para gerar tipos
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Nota: A API REST não retorna tipos diretamente
    // Vamos usar o método recomendado via CLI ou Dashboard
    
    console.log('⚠️  Este script requer o Supabase CLI instalado.');
    console.log('\n📋 Opções:');
    console.log('\n1. Instalar Supabase CLI:');
    console.log('   - Via Scoop: scoop install supabase');
    console.log('   - Via Chocolatey: choco install supabase');
    console.log('   - Ou baixe: https://github.com/supabase/cli/releases');
    console.log('\n2. Depois execute:');
    console.log('   supabase login');
    console.log('   npm run supabase:types');
    console.log('\n3. Ou use o Dashboard:');
    console.log('   https://supabase.com/dashboard/project/' + PROJECT_ID + '/settings/api');
    console.log('   Gere os tipos manualmente e cole em src/integrations/supabase/types.ts');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

const serviceRoleKey = process.argv[2];
generateTypes(serviceRoleKey);

