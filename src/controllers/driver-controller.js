import { prisma } from "../helpers/utils.js";

export const index = async (req, reply) => {
  try {
    const allEntries = await prisma.driver.findMany();
    reply.status(200).send(allEntries);
  } catch (error) {
    console.log(error);
  }
};

export const getDriverById = async (req, reply) => {
  const toEditDriver = await prisma.driver.findUnique({
    where: {
      id: +req.params.id,
    },
  });

  if (!toEditDriver) {
    reply.status(404).send("Motorista não encontrado");
  }
  reply.status(200).send(toEditDriver);
};

export const createDriver = async (req, reply) => {
  try {
    const { name, driverLicense, expirationDate, courses, category } = req.body;
    const driver = await prisma.driver.create({
      data: {
        name,
        driverLicense,
        expirationDate,
        courses,
        category,
      },
    });
    reply.status(201).send(driver);
  } catch (error) {
    console.log(error);
  }
};

export const deleteDriver = async (req, reply) => {
  const deletedDriver = await prisma.driver.delete({
    where: {
      id: +req.params.id,
    },
  });
  reply.send(deletedDriver);
};

export const updateDriver = async (req, reply) => {
  try {
    const { name, driverLicense, expirationDate, courses, category } = req.body;

    const newDriver = await prisma.driver.update({
      where: {
        id: +req.params.id,
      },
      data: {
        name,
        driverLicense,
        expirationDate,
        courses,
        category,
      },
    });
    reply.send(newDriver);
  } catch (error) {
    console.log(error);
  }
};
