export interface WhoAmIResponseDTO {
    username: string;
    firstname: string;
    lastname: string;
    displayName: string;
    email: string;
    domain: string;
    isAdmin: boolean;
    hasAccess: boolean;
    isUser: boolean;
    isManager: boolean;
    isSupervisor: boolean;
}
