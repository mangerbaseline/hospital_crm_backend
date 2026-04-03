import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controller/product.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();

router.use(protect);

router.get('/all-products', getProducts);
router.get('/:id', getProductById);
router.post('/create', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), createProduct);
router.put('/:id', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), updateProduct);
router.delete('/:id', authorizeRoles(UserRole.EXECUTIVE, UserRole.ADMIN), deleteProduct);

export default router;
