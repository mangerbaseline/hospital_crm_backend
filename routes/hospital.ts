import express from 'express';
import { getHospitals, getHospitalByHospitalId, createHospital, deleteHospital, updateHospital } from '../controller/hospital.ts';
import { protect, authorizeRoles } from '../middleware/authMiddleware.ts';
import { UserRole } from '../model/User.ts';

const router = express.Router();

router.use(protect);

router.get('/all-hospitals', getHospitals);
router.get('/:id', getHospitalByHospitalId);
router.post('/create', createHospital);
router.put('/:id', updateHospital);
router.delete('/:id', deleteHospital);

export default router;
