import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StaffAuthorizationService } from '../auth/authorization.js';
import { StaffAuthenticationService } from '../auth/service.js';
import { AuthenticationError, AuthorizationError } from '../auth/types.js';
import { CredentialContinuityError, CredentialContinuityService } from './service.js';

const uuid = z.string().uuid();
const body = z.object({ shadowImportRunId: uuid }).strict();
function bearer(request: FastifyRequest): string { const header=request.headers.authorization; if(!header?.startsWith('Bearer '))throw new AuthenticationError(); const token=header.slice(7).trim(); if(!token)throw new AuthenticationError(); return token; }
function requestId(request:FastifyRequest,reply:FastifyReply):string{const supplied=request.headers['x-correlation-id'];const id=typeof supplied==='string'&&uuid.safeParse(supplied).success?supplied:randomUUID();reply.header('x-correlation-id',id);return id;}
function sendError(reply:FastifyReply,error:unknown,id:string):boolean{if(error instanceof CredentialContinuityError){reply.code(error.statusCode).send({code:error.code,message:error.message,requestId:id,retryable:error.retryable});return true;}if(error instanceof AuthenticationError||error instanceof AuthorizationError){reply.code(error.statusCode).send({code:error instanceof AuthenticationError?'AUTH_REQUIRED':'CREDENTIAL_CONTINUITY_SCOPE_DENIED',message:error.message,requestId:id,retryable:false});return true;}return false;}

export function registerCredentialContinuityRoutes(app:FastifyInstance,options:{authentication:StaffAuthenticationService;authorization:StaffAuthorizationService;continuity:CredentialContinuityService}):void{
  app.post('/api/v1/internal/migration/credentials/continuity-plan',async(request,reply)=>{const id=requestId(request,reply);const parsed=body.safeParse(request.body);if(!parsed.success)return reply.code(400).send({code:'CREDENTIAL_CONTINUITY_INPUT_INVALID',message:'A certified shadow import run is required.',requestId:id,retryable:false});try{const principal=await options.authentication.authenticate(bearer(request));const schoolId=options.continuity.resolveSchoolId(principal,'admin.migration.credential_continuity');options.authorization.requireSchoolCapability(principal,schoolId,'admin.migration.credential_continuity');const result=await options.continuity.plan(principal,schoolId,parsed.data.shadowImportRunId);return{...result,schoolId,requestId:id};}catch(error){if(sendError(reply,error,id))return;throw error;}});
}
