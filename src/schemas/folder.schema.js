const { z } = require("zod");

exports.createFolderSchema = z.object({
  title: z
    .string({
      required_error: "El nombre es requerido",
      invalid_type_error: "El nombre debe ser un texto",
    })
    .min(1)
    .max(255),
});

exports.updateFolderSchema = z.object({
  title: z
    .string({
      required_error: "El nombre es requerido",
      invalid_type_error: "El nombre debe ser un texto",
    })
    .min(1)
    .max(255),
});
