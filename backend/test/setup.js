// Variables de entorno mínimas para los tests. JWT_SECRET es lo único que
// el código de auth necesita; las credenciales de DB/Cloudinary se omiten a
// propósito para forzar las ramas stubbeadas / sin servicios externos.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';
