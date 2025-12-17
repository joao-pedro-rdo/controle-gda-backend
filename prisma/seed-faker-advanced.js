import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker/locale/pt_BR";
import { genSaltSync, hash } from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encryptImage } from "../src/helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Helper para hash de senha
const hashPassword = (password) => {
  let salt = genSaltSync(10);
  return new Promise((res) => {
    hash(password, salt, (err, saltedPassword) => {
      res(saltedPassword);
    });
  });
};

// Gerar placa de veículo brasileira
const generateLicensePlate = () => {
  const oldFormat = Math.random() > 0.5;
  if (oldFormat) {
    return `${faker.string.alpha({ length: 3, casing: 'upper' })}-${faker.string.numeric(4)}`;
  } else {
    return `${faker.string.alpha({ length: 3, casing: 'upper' })}${faker.string.numeric(1)}${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.string.numeric(2)}`;
  }
};

const generateCPF = () => faker.string.numeric(11);
const generateRG = () => faker.string.numeric(9);
const generateCNH = () => faker.string.numeric(11);

const carColors = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Marrom', 'Bege'];
const carModels = ['Gol', 'Civic', 'Corolla', 'HB20', 'Onix', 'Uno', 'Palio', 'Fox', 'Kicks', 'Creta', 'Compass', 'Renegade', 'Argo', 'Polo', 'Voyage', 'Hilux', 'Ranger', 'Frontier', 'S10', 'Amarok'];
const companies = ['1ª Cia', '2ª Cia', '3ª Cia', '4ª Cia', 'EMI', 'Cmdo'];
const sections = ['Comando', 'S1', 'S2', 'S3', 'S4', '1º Pelotão', '2º Pelotão', '3º Pelotão', 'Administração', 'Inteligência', 'Operações'];
const locations = ['Cantina', 'Manutenção', 'Limpeza', 'Segurança', 'Jardinagem', 'Refeitório', 'Almoxarifado', 'Portaria'];
const visitDestinations = ['Comando do Batalhão', 'S2 - Inteligência', 'S1 - Pessoal', 'S3 - Operações', 'S4 - Logística', 'Almoxarifado', 'Enfermaria', 'Secretaria', 'Refeitório', 'Arsenal'];

console.log('🌱 Iniciando seed AVANÇADO do banco de dados...\n');

async function main() {
  // ============================================================================
  // 1. CRIAR USUÁRIOS
  // ============================================================================
  console.log('👥 Criando usuários...');
  
  const users = [];
  const roles = ['S2', 'Guarda', 'Scmt'];
  
  for (const role of roles) {
    const password = await hashPassword('teste123');
    const user = await prisma.user.upsert({
      where: { login: role.toLowerCase() },
      update: {},
      create: {
        login: role.toLowerCase(),
        role: role,
        password: password,
      },
    });
    users.push(user);
    console.log(`   ✓ Usuário ${role} criado`);
  }

  // ============================================================================
  // 2. CRIAR VEÍCULOS MILITARES
  // ============================================================================
  console.log('\n🚗 Criando veículos militares...');
  
  const vehicles = [];
  for (let i = 0; i < 50; i++) {
    const vehicle = await prisma.vehicles.create({
      data: {
        completeName: faker.person.fullName(),
        tagName: faker.person.firstName(),
        carModel: faker.helpers.arrayElement(carModels),
        licensePlate: generateLicensePlate(),
        color: faker.helpers.arrayElement(carColors),
        driverLicense: generateCNH(),
        idNumber: generateRG(),
        company: faker.helpers.arrayElement(companies),
        section: faker.helpers.arrayElement(sections),
      },
    });
    vehicles.push(vehicle);
  }
  console.log(`   ✓ ${vehicles.length} veículos criados`);

  // ============================================================================
  // 3. CRIAR PERMISSIONÁRIOS
  // ============================================================================
  console.log('\n👷 Criando permissionários...');
  
  const permissionarios = [];
  for (let i = 0; i < 30; i++) {
    try {
      const permissionario = await prisma.permissionario.create({
        data: {
          completeName: faker.person.fullName(),
          idNumber: generateRG(),
          CPF: generateCPF(),
          local: faker.helpers.arrayElement(locations),
          carModel: faker.helpers.arrayElement(carModels), // SEMPRE tem carro
          licensePlate: generateLicensePlate(), // SEMPRE tem placa
          color: faker.helpers.arrayElement(carColors), // SEMPRE tem cor
          imagePath: null,
        },
      });
      permissionarios.push(permissionario);
    } catch (error) {
      i--;
    }
  }
  console.log(`   ✓ ${permissionarios.length} permissionários criados`);

  // ============================================================================
  // 4. CRIAR PESSOAS NÃO AUTORIZADAS
  // ============================================================================
  console.log('\n🚫 Criando pessoas não autorizadas...');
  
  const pessoasNaoAutorizadas = [];
  for (let i = 0; i < 10; i++) {
    try {
      const pessoa = await prisma.pessoaNaoAutorizada.create({
        data: {
          nome: faker.person.fullName(),
          imagePath: null,
          identidade: generateRG(),
          CPF: generateCPF(),
          observacao: faker.lorem.sentence(),
        },
      });
      pessoasNaoAutorizadas.push(pessoa);
    } catch (error) {
      i--;
    }
  }
  console.log(`   ✓ ${pessoasNaoAutorizadas.length} pessoas não autorizadas criadas`);

  // ============================================================================
  // 5. CRIAR MOTORISTAS
  // ============================================================================
  console.log('\n🚙 Criando motoristas...');
  
  const drivers = [];
  for (let i = 0; i < 20; i++) {
    const driver = await prisma.driver.create({
      data: {
        name: faker.person.fullName(),
        driverLicense: generateCNH(),
        expirationDate: faker.date.future({ years: 2 }),
        courses: faker.helpers.arrayElement([
          'Direção Defensiva',
          'Transporte de Tropas',
          'Operação de Viaturas Blindadas',
          'Direção de Veículos Pesados',
          null
        ]),
        category: faker.helpers.arrayElement(['B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']),
      },
    });
    drivers.push(driver);
  }
  console.log(`   ✓ ${drivers.length} motoristas criados`);

  // ============================================================================
  // 6. CRIAR VIATURAS
  // ============================================================================
  console.log('\n🚛 Criando viaturas...');
  
  const viaturas = [];
  const viaturaModels = [
    'Caminhão MB 1318', 'Viatura VW Amarok', 'Caminhonete S10',
    'URO VBTP', 'Jeep Willys', 'Toyota Bandeirante',
    'Iveco Daily', 'Ford Ranger', 'Mitsubishi L200'
  ];
  
  for (let i = 0; i < 15; i++) {
    const viatura = await prisma.viatura.create({
      data: {
        model: faker.helpers.arrayElement(viaturaModels),
        licensePlate: generateLicensePlate(),
        complements: Math.random() > 0.5 ? faker.lorem.sentence() : null,
      },
    });
    viaturas.push(viatura);
  }
  console.log(`   ✓ ${viaturas.length} viaturas criadas`);

  // ============================================================================
  // 7. CRIAR MISSÕES
  // ============================================================================
  console.log('\n📋 Criando missões...');
  
  const missions = [];
  const destinations = [
    'Comando Militar do Sul', 'Base Aérea de Canoas',
    'Porto Alegre - Centro', 'Hospital Militar',
    'CMPA - Comando Militar de Porto Alegre',
    'Depósito de Suprimentos', 'Quartel em Santa Maria'
  ];
  
  for (let i = 0; i < 25; i++) {
    const mission = await prisma.mission.create({
      data: {
        viaturaId: faker.helpers.arrayElement(viaturas).id,
        driverId: faker.helpers.arrayElement(drivers).id,
        dateMission: faker.date.between({ 
          from: new Date(2024, 0, 1), 
          to: new Date() 
        }),
        isActive: Math.random() > 0.3,
        isAuthorized: Math.random() > 0.2,
        complements: faker.lorem.sentence(),
        initialOdometer: faker.string.numeric(6),
        finalOdometer: Math.random() > 0.5 ? faker.string.numeric(6) : null,
        chefeVtr: faker.person.fullName(),
        destination: faker.helpers.arrayElement(destinations),
      },
    });
    missions.push(mission);
  }
  console.log(`   ✓ ${missions.length} missões criadas`);

  // ============================================================================
  // 8. PREPARAR IMAGEM PADRÃO PARA VISITANTES
  // ============================================================================
  console.log('\n📷 Preparando imagem padrão para visitantes...');
  
  let defaultImagePath = null;
  try {
    const personImageSource = path.join(__dirname, 'person.png');
    const visitorsDir = path.join(__dirname, '../uploads/visitors');
    
    // Garantir que o diretório existe
    if (!fs.existsSync(visitorsDir)) {
      fs.mkdirSync(visitorsDir, { recursive: true });
    }
    
    if (fs.existsSync(personImageSource)) {
      const defaultFileName = 'default_person.jpg';
      const defaultFilePath = path.join(visitorsDir, defaultFileName);
      
      // Copiar imagem padrão
      fs.copyFileSync(personImageSource, defaultFilePath);
      
      // Criptografar imagem
      encryptImage(defaultFilePath);
      defaultImagePath = `/uploads/visitors/${defaultFileName}.encrypted`;
      
      console.log(`   ✓ Imagem padrão preparada: ${defaultImagePath}`);
    } else {
      console.log('   ⚠️ Arquivo person.png não encontrado, entradas sem imagem');
    }
  } catch (error) {
    console.error('   ❌ Erro ao preparar imagem padrão:', error.message);
    defaultImagePath = null;
  }

  // ============================================================================
  // 9. CRIAR ENTRADAS (Usando lógica similar ao controller)
  // ============================================================================
  console.log('\n📥 Criando entradas (últimos 3 dias)...');
  
  const entries = [];
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const now = new Date();
  
  // 9.1 - Entradas de VISITANTES
  console.log('   📋 Criando entradas de visitantes...');
  for (let i = 0; i < 150; i++) {
    const isScheduled = Math.random() > 0.8;
    const entryTime = faker.date.between({ from: threeDaysAgo, to: now });
    
    const entry = await prisma.entry.create({
      data: {
        type: 'Entrada',
        isVisitor: true,
        isPermissionario: false,
        isScheduled: isScheduled,
        scheduledDate: isScheduled ? faker.date.future() : null,
        name: faker.person.fullName(),
        idNumber: generateRG(),
        licensePlate: generateLicensePlate(),
        carModel: faker.helpers.arrayElement(carModels),
        time: entryTime,
        target: faker.helpers.arrayElement(visitDestinations),
        contactPerson: faker.person.fullName(),
        color: faker.helpers.arrayElement(carColors),
        exited: false, // Todos começam como não saídos
        phoneNumber: faker.phone.number('(##) #####-####'),
        imagePath: defaultImagePath, // Usar imagem padrão
      },
    });
    entries.push(entry);
  }
  console.log(`      ✓ ${entries.filter(e => e.isVisitor).length} visitantes criados`);
  
  // 9.2 - Entradas de PERMISSIONÁRIOS
  console.log('   📋 Criando entradas de permissionários...');
  for (const permissionario of permissionarios) {
    const numEntries = faker.number.int({ min: 3, max: 8 });
    
    for (let i = 0; i < numEntries; i++) {
      const entryTime = faker.date.between({ from: threeDaysAgo, to: now });
      
      const entry = await prisma.entry.create({
        data: {
          type: 'Entrada',
          isVisitor: false,
          isPermissionario: true,
          isScheduled: false,
          name: permissionario.completeName,
          idNumber: permissionario.idNumber,
          licensePlate: permissionario.licensePlate, // Agora sempre tem placa
          carModel: permissionario.carModel, // Agora sempre tem modelo
          time: entryTime,
          target: permissionario.local,
          contactPerson: null,
          color: permissionario.color, // Agora sempre tem cor
          exited: false, // Todos começam como não saídos
          phoneNumber: faker.phone.number('(##) #####-####'),
          imagePath: permissionario.imagePath,
        },
      });
      entries.push(entry);
    }
  }
  console.log(`      ✓ ${entries.filter(e => e.isPermissionario).length} entradas de permissionários criadas`);
  
  // 9.3 - Entradas de MILITARES
  console.log('   📋 Criando entradas de militares...');
  for (const vehicle of vehicles) {
    const numEntries = faker.number.int({ min: 2, max: 6 });
    
    for (let i = 0; i < numEntries; i++) {
      const entryTime = faker.date.between({ from: threeDaysAgo, to: now });
      
      const entry = await prisma.entry.create({
        data: {
          type: 'militar',
          isVisitor: false,
          isPermissionario: false,
          isScheduled: false,
          name: vehicle.completeName,
          idNumber: vehicle.idNumber,
          licensePlate: vehicle.licensePlate,
          carModel: vehicle.carModel,
          time: entryTime,
          target: faker.helpers.arrayElement(sections),
          contactPerson: null,
          color: vehicle.color,
          exited: false, // Todos começam como não saídos
          phoneNumber: null,
          imagePath: null,
        },
      });
      entries.push(entry);
    }
  }
  console.log(`      ✓ ${entries.filter(e => e.type === 'militar').length} entradas de militares criadas`);

  // ============================================================================
  // 10. CRIAR SAÍDAS (80% das entradas já saíram)
  // ============================================================================
  console.log('\n🚪 Criando saídas...');
  
  const exits = [];
  const entriesToExit = entries.filter(() => Math.random() > 0.2); // 80% vão ter saída
  
  for (const originalEntry of entriesToExit) {
    // Criar tempo de saída entre a entrada e agora
    const exitTime = faker.date.between({ 
      from: originalEntry.time, 
      to: now 
    });
    
    // Criar registro de saída
    const exitEntry = await prisma.entry.create({
      data: {
        type: 'Saída',
        isVisitor: originalEntry.isVisitor,
        isPermissionario: originalEntry.isPermissionario,
        isScheduled: false,
        name: originalEntry.name,
        idNumber: originalEntry.idNumber,
        licensePlate: originalEntry.licensePlate,
        carModel: originalEntry.carModel,
        time: exitTime,
        target: originalEntry.target,
        contactPerson: originalEntry.contactPerson,
        color: originalEntry.color,
        phoneNumber: originalEntry.phoneNumber,
        imagePath: originalEntry.imagePath, // Mesma imagem da entrada
        exited: false, // Saída não tem flag exited
      },
    });
    
    // Marcar entrada original como exited
    await prisma.entry.update({
      where: { id: originalEntry.id },
      data: { exited: true },
    });
    
    exits.push(exitEntry);
  }
  
  console.log(`   ✓ ${exits.length} saídas criadas`);

  // ============================================================================
  // RESUMO
  // ============================================================================
  console.log('\n✅ Seed avançado concluído com sucesso!\n');
  console.log('📊 Resumo:');
  console.log(`   • ${users.length} usuários`);
  console.log(`   • ${vehicles.length} veículos militares`);
  console.log(`   • ${permissionarios.length} permissionários`);
  console.log(`   • ${pessoasNaoAutorizadas.length} pessoas não autorizadas`);
  console.log(`   • ${drivers.length} motoristas`);
  console.log(`   • ${viaturas.length} viaturas`);
  console.log(`   • ${missions.length} missões`);
  console.log(`   • ${entries.length} entradas registradas`);
  console.log(`   • ${exits.length} saídas registradas`);
  console.log(`   • ${entries.filter(e => !e.exited).length} pessoas ainda dentro da OM`);
  
  console.log('\n📈 Estatísticas por tipo:');
  console.log(`   • Visitantes: ${entries.filter(e => e.isVisitor).length} entradas`);
  console.log(`   • Permissionários: ${entries.filter(e => e.isPermissionario).length} entradas`);
  console.log(`   • Militares: ${entries.filter(e => e.type === 'militar').length} entradas`);
  
  console.log('\n🔐 Credenciais de login:');
  console.log('   • login: s2       | senha: teste123 | role: S2');
  console.log('   • login: guarda   | senha: teste123 | role: Guarda');
  console.log('   • login: scmt     | senha: teste123 | role: Scmt');
  
  console.log('\n💡 Dica: Agora você pode testar:');
  console.log('   • Buscar permissionários por CPF');
  console.log('   • Registrar novas entradas de permissionários existentes');
  console.log('   • Registrar saídas das pessoas que ainda estão dentro');
  console.log('   • Gerar relatórios dos últimos 3 dias');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro ao executar seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
