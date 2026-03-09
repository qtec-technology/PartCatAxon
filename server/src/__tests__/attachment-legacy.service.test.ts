import { describe, expect, it } from 'vitest';
import {
    buildLegacyAttachmentFileName,
    canDeleteAttachmentByActor,
    normalizeItemImageExt,
    sanitizeLegacyFileSegment,
} from '#src/services/attachment-legacy.service.js';

describe('attachment-legacy.service', () => {
    it('sanitizes category names for legacy file naming', () => {
        expect(sanitizeLegacyFileSegment('Spec Sheet', 'Attachment')).toBe('SpecSheet');
        expect(sanitizeLegacyFileSegment('Draw:ing*', 'Attachment')).toBe('Drawing');
        expect(sanitizeLegacyFileSegment('', 'Attachment')).toBe('Attachment');
    });

    it('builds legacy item and term attachment file names with suffixes', () => {
        expect(buildLegacyAttachmentFileName('ITEM', 1024, 'Drawing', 'vendor-file.pdf', 0)).toBe('I1024Drawing.pdf');
        expect(buildLegacyAttachmentFileName('TERM', 2048, 'Drawing', 'vendor-file.pdf', 1)).toBe('T2048Drawing_0.pdf');
        expect(buildLegacyAttachmentFileName('TERM', 2048, 'Spec Sheet', 'sheet.xlsx', 2)).toBe('T2048SpecSheet_1.xlsx');
    });

    it('allows only legacy item image extensions', () => {
        expect(normalizeItemImageExt('photo.JPG', 'image/jpeg')).toBe('.jpg');
        expect(normalizeItemImageExt('photo.png', 'image/png')).toBe('.png');
        expect(() => normalizeItemImageExt('photo.jpeg', 'image/jpeg')).toThrow('Unsupported image type');
    });

    it('allows owner, supervisor, or manager to delete attachment', () => {
        expect(canDeleteAttachmentByActor('alice', {
            username: 'alice',
            firstname: 'Alice',
            lastname: 'Smith',
            displayName: 'Alice Smith',
            email: '',
            domain: '',
            isManager: false,
            isSupervisor: false,
        })).toBe(true);

        expect(canDeleteAttachmentByActor('owner-name', {
            username: 'bob',
            firstname: 'Bob',
            lastname: 'Jones',
            displayName: 'Bob Jones',
            email: '',
            domain: '',
            isManager: false,
            isSupervisor: true,
        })).toBe(true);

        expect(canDeleteAttachmentByActor('owner-name', {
            username: 'carol',
            firstname: 'Carol',
            lastname: 'Ng',
            displayName: 'Carol Ng',
            email: '',
            domain: '',
            isManager: false,
            isSupervisor: false,
        })).toBe(false);
    });
});
