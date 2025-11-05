import { prisma } from "../helpers/utils.js";

export const index = async (req, reply) => {
  try {
    const allVehicles = await prisma.vehicles.findMany();
    reply.status(200).send(allVehicles);
  } catch (error) {
    console.log(error);
  }
};

export const getVehicleById = async (req, reply) => {
  const toEditVehicle = await prisma.vehicles.findUnique({
    where: {
      id: +req.params.id,
    },
  });

  if (!toEditVehicle) {
    reply.status(404).send("Veículo não encontrado");
  }
  reply.status(200).send(toEditVehicle);
};

export const getVehicleByLicensePlate = async (req, reply) => {
  const vehicle = await prisma.vehicles.findFirst({
    where: {
      licensePlate: req.params.licensePlate,
    },
  });

  // Add a 2-second delay 
  // [ ] DELAY DE TESTES 
  //await new Promise(resolve => setTimeout(resolve, 1000));

  if (!vehicle) {
    reply.status(404).send("Veículo não encontrado");
  }
  reply.status(200).send(vehicle);
};

export const updateVehicle = async (req, reply) => {
  try {
    const {
      completeName,
      tagName,
      carModel,
      licensePlate,
      color,
      driverLicense,
      idNumber,
      company,
      section,
    } = req.body;

    const newVehicle = await prisma.vehicles.update({
      where: {
        id: +req.params.id,
      },
      data: {
        completeName,
        tagName,
        carModel,
        licensePlate,
        color,
        driverLicense,
        idNumber,
        company,
        section,
      },
    });
    reply.send(newVehicle);
  } catch (error) {
    console.log("Deu merda");
    console.log(error);
  }
};

export const createVehicle = async (req, reply) => {
  try {
    const {
      completeName,
      tagName,
      carModel,
      licensePlate,
      color,
      driverLicense,
      idNumber,
      company,
      section,
    } = req.body;
    const vehicle = await prisma.vehicles.create({
      data: {
        completeName,
        tagName,
        carModel,
        licensePlate,
        color,
        driverLicense,
        idNumber,
        company,
        section,
      },
    });
    reply.status(201).send(vehicle);
  } catch (error) {
    console.log(error);
  }
};

export const deleteVehicle = async (req, reply) => {
  const deletedVehicle = await prisma.vehicles.delete({
    where: {
      id: +req.params.id,
    },
  });
  reply.send(deletedVehicle);
};
