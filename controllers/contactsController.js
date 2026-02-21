import prisma from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { statusCode } from '../utils/statusCode.js';
import { checkUserId } from '../utils/validators.js';

const createEmergencyContact = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { emergencyContacts } = req.body;
    if (!Array.isArray(emergencyContacts) || emergencyContacts.length === 0 || !userId) {
        return res.status(statusCode.BadRequest400).json({
            message: "add emergency contacts"
        });
    }
    const isUserIdValid = await checkUserId(userId);
    if (!isUserIdValid) {
        return res.status(statusCode.NotFound404).json({
            message: "User not found"
        });
    }

    const seenPhoneNumbers = new Set();
    const duplicateContacts = emergencyContacts.filter((contact) => {
        if (seenPhoneNumbers.has(contact.phoneNumber)) return true;
        seenPhoneNumbers.add(contact.phoneNumber);
        return false;
    });

    if (duplicateContacts.length > 0) {
        return res.status(statusCode.BadRequest400).json({
            message: "Duplicate contacts found",
            duplicates: duplicateContacts
        });
    }

    const existingDBContacts = await prisma.emergencyContact.findMany({
        where: {
            userId,
            phoneNumber: { in: emergencyContacts.map(c => c.phoneNumber) }
        }
    });

    if (existingDBContacts.length > 0) {
        return res.status(statusCode.BadRequest400).json({
            message: "Some phone numbers already exist",
            duplicates: existingDBContacts
        });
    }
    const createdContacts = await prisma.emergencyContact.createMany({
        data: emergencyContacts.map((contact) => ({
            ...contact,
            userId: userId,
        })),
    });

    return res.status(statusCode.Created201).json({
        message: "Emergency contacts created successfully",
        count: createdContacts.count,
    });
});

const addSingleEmergencyContact = asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    const { name, phoneNumber, email, relationship } = req.body;

    if (!name || !phoneNumber) {
        return res.status(statusCode.BadRequest400).json({
            message: "Name and phone number are required"
        });
    }

    const existingContact = await prisma.emergencyContact.findFirst({
        where: { userId, phoneNumber }
    });

    if (existingContact) {
        return res.status(statusCode.BadRequest400).json({
            message: "This phone number already exists in your list"
        });
    }

    const createdContact = await prisma.emergencyContact.create({
        data: {
            userId,
            name,
            phoneNumber,
            email: email ?? null,
            relationship: relationship ?? null,
        }
    });

    return res.status(statusCode.Created201).json({
        message: "Emergency contact created successfully",
        contact: createdContact
    });
});

const updateEmergencyContact = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { contactId, name, phoneNumber, email, relationship } = req.body;

    const existingContact = await prisma.emergencyContact.findUnique({
        where: { id: contactId },
    });

    if (!existingContact) {
        return res.status(statusCode.NotFound404).json({
            message: "Contact not found",
        });
    }

    // Ownership check: verify contact belongs to authenticated user
    if (existingContact.userId !== userId) {
        return res.status(statusCode.Forbidden403).json({
            message: "You do not own this contact",
        });
    }

    const updatedContact = await prisma.emergencyContact.update({
        where: { id: existingContact.id },
        data: {
            name: name ?? existingContact.name,
            phoneNumber: phoneNumber ?? existingContact.phoneNumber,
            email: email ?? existingContact.email,
            relationship: relationship ?? existingContact.relationship,
        },
    });
    return res.status(statusCode.Ok200).json({
        message: "Contact updated successfully",
        contact: updatedContact,
    });
});

const deleteContact = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { contactId } = req.body;
    if (!contactId) {
        return res.status(statusCode.BadRequest400).json({
            message: "Contact ID is required",
        });
    }
    const existingContact = await prisma.emergencyContact.findUnique({
        where: { id: contactId },
    });
    if (!existingContact) {
        return res.status(statusCode.NotFound404).json({
            message: "Contact not found",
        });
    }

    // Ownership check: verify contact belongs to authenticated user
    if (existingContact.userId !== userId) {
        return res.status(statusCode.Forbidden403).json({
            message: "You do not own this contact",
        });
    }

    await prisma.emergencyContact.delete({
        where: { id: existingContact.id },
    });
    return res.status(statusCode.Ok200).json({
        message: "Contact deleted successfully",
    });
});

const getAllContactsByUserId = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const contacts = await prisma.emergencyContact.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' }
    });
    if (!contacts) {
        return res.status(statusCode.NotFound404).json({
            message: "No contacts found",
        });
    }
    return res.status(statusCode.Ok200).json({
        message: "Contacts retrieved successfully",
        contacts: contacts,
    });
});

export {
  createEmergencyContact,
  updateEmergencyContact,
  deleteContact,
  getAllContactsByUserId,
  addSingleEmergencyContact
};