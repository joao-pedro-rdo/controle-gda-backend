import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker/locale/pt_BR";
import { genSaltSync, hash } from "bcrypt";

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
    // Formato antigo: ABC-1234
    return `${faker.string.alpha({ length: 3, casing: 'upper' })}-${faker.string.numeric(4)}`;
  } else {
    // Formato Mercosul: ABC1D23
    return `${faker.string.alpha({ length: 3, casing: 'upper' })}${faker.string.numeric(1)}${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.string.numeric(2)}`;
  }
};

// Gerar CPF válido (simplificado)
const generateCPF = () => {
  return faker.string.numeric(11);
};

// Gerar RG
const generateRG = () => {
  return faker.string.numeric(9);
};

// Gerar CNH
const generateCNH = () => {
  return faker.string.numeric(11);
};

// Cores de veículos comuns
const carColors = [
  'Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 
  'Azul', 'Verde', 'Amarelo', 'Marrom', 'Bege'
];

// Modelos de carros comuns
const carModels = [
  'Gol', 'Civic', 'Corolla', 'HB20', 'Onix',
  'Uno', 'Palio', 'Fox', 'Kicks', 'Creta',
  'Compass', 'Renegade', 'Argo', 'Polo', 'Voyage',
  'Hilux', 'Ranger', 'Frontier', 'S10', 'Amarok'
];

// Companhias militares
const companies = ['1ª Cia', '2ª Cia', '3ª Cia', '4ª Cia', 'EMI', 'Cmdo'];

// Seções militares
const sections = [
  'Comando', 'S1', 'S2', 'S3', 'S4', 
  '1º Pelotão', '2º Pelotão', '3º Pelotão',
  'Administração', 'Inteligência', 'Operações'
];

// Locais para permissionários
const locations = [
  'Cantina', 'Manutenção', 'Limpeza', 'Segurança',
  'Jardinagem', 'Refeitório', 'Almoxarifado', 'Portaria'
];

// Destinos de visitas
const visitDestinations = [
  'Comando do Batalhão', 'S2 - Inteligência', 'S1 - Pessoal',
  'S3 - Operações', 'S4 - Logística', 'Almoxarifado',
  'Enfermaria', 'Secretaria', 'Refeitório', 'Arsenal'
];

console.log('🌱 Iniciando seed do banco de dados...\n');

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
    console.log(`   ✓ Usuário ${role} criado (login: ${role.toLowerCase()}, senha: teste123)`);
  }

  // ============================================================================
  // 2. CRIAR VEÍCULOS
  // ============================================================================
  console.log('\n🚗 Criando veículos...');
  
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
          carModel: Math.random() > 0.3 ? faker.helpers.arrayElement(carModels) : null,
          licensePlate: Math.random() > 0.3 ? generateLicensePlate() : null,
          color: Math.random() > 0.3 ? faker.helpers.arrayElement(carColors) : null,
          imagePath: null, // Pode adicionar depois manualmente
        },
      });
      permissionarios.push(permissionario);
    } catch (error) {
      // Ignora erro de CPF duplicado e tenta novamente
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
  // 8. CRIAR ENTRADAS (Visitantes + Permissionários + Militares)
  // ============================================================================
  console.log('\n📥 Criando entradas...');
  
  const entries = [];
  
  // 8.1 - Entradas de VISITANTES
  for (let i = 0; i < 80; i++) {
    const isScheduled = Math.random() > 0.7;
    const hasExited = Math.random() > 0.4;
    const entryTime = faker.date.between({ 
      from: new Date(2024, 11, 1), 
      to: new Date() 
    });
    
    const entry = await prisma.entry.create({
      data: {
        type: 'civil',
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
        exited: hasExited,
        phoneNumber: faker.phone.number('(##) #####-####'),
        imagePath: null,
      },
    });
    entries.push(entry);
  }
  
  // 8.2 - Entradas de PERMISSIONÁRIOS
  for (let i = 0; i < 40; i++) {
    const permissionario = faker.helpers.arrayElement(permissionarios);
    const hasExited = Math.random() > 0.3;
    const entryTime = faker.date.between({ 
      from: new Date(2024, 11, 1), 
      to: new Date() 
    });
    
    const entry = await prisma.entry.create({
      data: {
        type: 'civil',
        isVisitor: false,
        isPermissionario: true,
        isScheduled: false,
        name: permissionario.completeName,
        idNumber: permissionario.idNumber,
        licensePlate: permissionario.licensePlate || generateLicensePlate(),
        carModel: permissionario.carModel || faker.helpers.arrayElement(carModels),
        time: entryTime,
        target: permissionario.local,
        contactPerson: null,
        color: permissionario.color || faker.helpers.arrayElement(carColors),
        exited: hasExited,
        phoneNumber: faker.phone.number('(##) #####-####'),
        imagePath: permissionario.imagePath,
      },
    });
    entries.push(entry);
  }
  
  // 8.3 - Entradas de MILITARES
  for (let i = 0; i < 30; i++) {
    const vehicle = faker.helpers.arrayElement(vehicles);
    const hasExited = Math.random() > 0.5;
    const entryTime = faker.date.between({ 
      from: new Date(2024, 11, 1), 
      to: new Date() 
    });
    
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
        exited: hasExited,
        phoneNumber: null,
        imagePath: null,
      },
    });
    entries.push(entry);
  }
  
  console.log(`   ✓ ${entries.length} entradas criadas (${entries.filter(e => e.isVisitor).length} visitantes, ${entries.filter(e => e.isPermissionario).length} permissionários, ${entries.filter(e => e.type === 'militar').length} militares)`);

  // ============================================================================
  // RESUMO
  // ============================================================================
  console.log('\n✅ Seed concluído com sucesso!\n');
  console.log('📊 Resumo:');
  console.log(`   • ${users.length} usuários`);
  console.log(`   • ${vehicles.length} veículos`);
  console.log(`   • ${permissionarios.length} permissionários`);
  console.log(`   • ${pessoasNaoAutorizadas.length} pessoas não autorizadas`);
  console.log(`   • ${drivers.length} motoristas`);
  console.log(`   • ${viaturas.length} viaturas`);
  console.log(`   • ${missions.length} missões`);
  console.log(`   • ${entries.length} entradas`);
  console.log(`   • ${entries.filter(e => !e.exited).length} pessoas dentro do quartel agora`);
  
  console.log('\n🔐 Credenciais de login:');
  console.log('   • login: s2       | senha: teste123 | role: S2');
  console.log('   • login: guarda   | senha: teste123 | role: Guarda');
  console.log('   • login: scmt     | senha: teste123 | role: Scmt');
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
