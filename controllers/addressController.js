import prisma from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { statusCode } from '../utils/statusCode.js';
import { checkUserId } from '../utils/validators.js';

const createAddress = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { street, city, country, zipCode, state, type, latitude, longitude, radiusMeters } = req.body;

    if (!longitude || !latitude || !type) {
        return res.status(statusCode.BadRequest400).json({
            message: "All fields are required",
        });
    }
    const isUserIdValid = await checkUserId(userId);
    if (!isUserIdValid) {
        return res.status(statusCode.NotFound404).json({
            message: "User not found",
        });
    }
    const createdAddress = await prisma.address.create({
        data: {
            street,
            city,
            country,
            zipCode,
            state,
            type,
            userId: userId,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            radiusMeters: radiusMeters ?? null,
        },
    });
    return res.status(statusCode.Created201).json({
        message: "Address created successfully",
        address: createdAddress,
    });
});

const updateAddress = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { addressId, street, city, country, zipCode, state, type, longitude, latitude, radiusMeters } = req.body;

    if (!addressId) {
        return res.status(statusCode.BadRequest400).json({
            message: "Address Id is required"
        });
    }

    if (!street && !city && !country && !zipCode && !state && !type && !latitude && !longitude && !radiusMeters) {
        return res.status(statusCode.BadRequest400).json({
            message: "At least one field is required",
        });
    }

    const existingAddress = await prisma.address.findUnique({
        where: { id: addressId },
    });

    if (!existingAddress) {
        return res.status(statusCode.NotFound404).json({
            message: "Address not found",
        });
    }

    // Ownership check
    if (existingAddress.userId !== userId) {
        return res.status(statusCode.Forbidden403).json({
            message: "You do not own this address",
        });
    }

    const updatedAddress = await prisma.address.update({
        where: { id: addressId },
        data: {
            street,
            city,
            country,
            zipCode,
            state,
            type,
            latitude,
            longitude,
            radiusMeters
        },
    });
    return res.status(statusCode.Ok200).json({
        message: "Address updated successfully",
        address: updatedAddress,
    });
});

const deleteAddress = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { addressId } = req.body;
    if (!addressId) {
        return res.status(statusCode.NotFound404).json({
            message: "Address ID is required",
        });
    }

    const existingAddress = await prisma.address.findUnique({
        where: { id: addressId },
    });

    if (!existingAddress) {
        return res.status(statusCode.NotFound404).json({
            message: "Address not found",
        });
    }

    // Ownership check
    if (existingAddress.userId !== userId) {
        return res.status(statusCode.Forbidden403).json({
            message: "You do not own this address",
        });
    }

    const deletedAddress = await prisma.address.delete({
        where: { id: addressId },
    });
    return res.status(statusCode.Ok200).json({
        message: "Address deleted successfully",
        address: deletedAddress,
    });
});

const getAllAddresses = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const isUserIdValid = await checkUserId(userId);
    if (!isUserIdValid) {
        return res.status(statusCode.NotFound404).json({
            message: "User not found",
        });
    }

    const addresses = await prisma.address.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' }
    });

    if (!addresses) {
        return res.status(statusCode.NotFound404).json({
            message: "No addresses found",
        });
    }
    return res.status(statusCode.Ok200).json({
        message: "Addresses retrieved successfully",
        addresses: addresses,
    });
});

export {
    createAddress,
    updateAddress,
    deleteAddress,
    getAllAddresses
};