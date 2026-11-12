/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckReport } from '../models/CheckReport';
import type { CheckRequest } from '../models/CheckRequest';
import type { FollowSettings } from '../models/FollowSettings';
import type { FollowSettingsInput } from '../models/FollowSettingsInput';
import type { RepoAnalysisInput } from '../models/RepoAnalysisInput';
import type { RepoAnalysisOutput } from '../models/RepoAnalysisOutput';
import type { RepoHistoryResponse } from '../models/RepoHistoryResponse';
import type { RepoMetadata } from '../models/RepoMetadata';
import type { RepoSummary } from '../models/RepoSummary';
import type { ScoringConfigResponse } from '../models/ScoringConfigResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DefaultService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Retrieve the OpenAPI specification
     * @returns any OpenAPI document
     * @throws ApiError
     */
    public getApiOpenapi(): CancelablePromise<Record<string, any>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/openapi',
        });
    }
    /**
     * List known repositories with latest summary
     * @param limit Maximum number of repositories to return
     * @param q Case-insensitive search term matched against owner, name, description and repository URL, and exactly (lowercased) against topics. Omit or leave blank to list all repositories.
     * @returns any Repository summary list
     * @throws ApiError
     */
    public getApiRepositories(
        limit: number = 12,
        q?: string,
    ): CancelablePromise<{
        repositories?: Array<RepoSummary>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/repositories',
            query: {
                'limit': limit,
                'q': q,
            },
        });
    }
    /**
     * Create or update repository metadata
     * @param requestBody
     * @returns RepoSummary Repository metadata saved
     * @throws ApiError
     */
    public postApiRepositories(
        requestBody: RepoMetadata,
    ): CancelablePromise<RepoSummary> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/repositories',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid repository metadata`,
            },
        });
    }
    /**
     * Run full analysis and persist result
     * @param requestBody
     * @returns CheckReport Analysis report
     * @throws ApiError
     */
    public postApiCheck(
        requestBody: CheckRequest,
    ): CancelablePromise<CheckReport> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/check',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid analysis request`,
            },
        });
    }
    /**
     * Stream progress events during analysis
     * @param requestBody
     * @returns string Analysis progress streamed as text/event-stream
     * @throws ApiError
     */
    public postApiCheckStream(
        requestBody: CheckRequest,
    ): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/check/stream',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid analysis request`,
            },
        });
    }
    /**
     * Create a new analysis result for an existing repository
     * @param repoId
     * @param requestBody
     * @returns RepoAnalysisOutput Analysis result created
     * @throws ApiError
     */
    public postApiRepositoriesAnalyses(
        repoId: string,
        requestBody: RepoAnalysisInput,
    ): CancelablePromise<RepoAnalysisOutput> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/repositories/{repoId}/analyses',
            path: {
                'repoId': repoId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid analysis payload`,
                404: `Repository not found`,
            },
        });
    }
    /**
     * Follow or unfollow a repository for scheduled rescans
     * Admin only. Requires `Authorization: Bearer <ADMIN_TOKEN>`. Disabled with 503 when the backend has no ADMIN_TOKEN configured.
     * @param repoId
     * @param requestBody
     * @returns FollowSettings Follow settings saved
     * @throws ApiError
     */
    public putApiRepositoriesFollow(
        repoId: string,
        requestBody: FollowSettingsInput,
    ): CancelablePromise<FollowSettings> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/repositories/{repoId}/follow',
            path: {
                'repoId': repoId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid follow settings`,
                401: `Missing or invalid admin token`,
                404: `Repository not found`,
                503: `Admin actions are disabled because ADMIN_TOKEN is not configured`,
            },
        });
    }
    /**
     * Return analysis history for a repository
     * @param owner
     * @param repo
     * @param limit
     * @returns RepoHistoryResponse Repository history
     * @throws ApiError
     */
    public getApiRepoHistory(
        owner: string,
        repo: string,
        limit: number = 50,
    ): CancelablePromise<RepoHistoryResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/repo-history',
            query: {
                'owner': owner,
                'repo': repo,
                'limit': limit,
            },
        });
    }
    /**
     * Retrieve current scoring configuration
     * @returns ScoringConfigResponse Current scoring configuration
     * @throws ApiError
     */
    public getApiAdminScoring(): CancelablePromise<ScoringConfigResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/admin/scoring',
        });
    }
    /**
     * Save scoring configuration snapshot
     * @param requestBody
     * @returns ScoringConfigResponse Saved scoring configuration snapshot
     * @throws ApiError
     */
    public postApiAdminScoring(
        requestBody: {
            reset?: boolean;
            criterionWeights?: Record<string, number>;
            criterionRequirementLevels?: Record<string, 'mandatory' | 'recommended'>;
            categoryWeights?: Record<string, number>;
            complexityThreshold?: number;
            complexityMaxCcnThreshold?: number;
            spectralRulesetSource?: string;
        },
    ): CancelablePromise<ScoringConfigResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/admin/scoring',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
