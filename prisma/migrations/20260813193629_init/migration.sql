-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('REQUESTER', 'TRIAGE', 'GOVERNANCE', 'DELIVERY', 'ADMIN');

-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('FUNCTION', 'VALUE_LEVER', 'SYSTEM', 'SPECIALIST_WORKFLOW', 'TAG');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('SPECIALIST_SPECIALIST', 'SPECIALIST_PORTCO', 'GENERALIST_PORTCO');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'TRIAGE', 'READY_FOR_GOVERNANCE', 'GOVERNANCE_REVIEW', 'APPROVED_AWAITING_CAPACITY', 'APPROVED_SCHEDULED', 'IN_DELIVERY', 'DEPLOYED', 'MEASURING_IMPACT', 'COMPLETED', 'DEFERRED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EffortEstimate" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "DataAccessStatus" AS ENUM ('CONFIRMED', 'LIKELY', 'UNCONFIRMED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('SENSITIVE_DATA', 'SECURITY_REVIEW_REQUIRED', 'DATA_ACCESS_UNCONFIRMED', 'SPONSOR_UNCONFIRMED', 'THIRD_PARTY_DEPENDENCY', 'SIGNIFICANT_CHANGE_MANAGEMENT', 'EXISTING_REUSABLE_SOLUTION', 'SIMILAR_REQUESTS_EXIST', 'EXECUTIVE_DEADLINE', 'MEASUREMENT_BASELINE_MISSING');

-- CreateEnum
CREATE TYPE "ScoringModelType" AS ENUM ('PORTFOLIO', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "ScoreDimension" AS ENUM ('BUSINESS_IMPACT', 'TIME_TO_ARTIFACT', 'DATA_FEASIBILITY', 'SPONSORSHIP', 'STRATEGIC_FIT');

-- CreateEnum
CREATE TYPE "GovernanceDecisionType" AS ENUM ('APPROVE', 'APPROVE_AWAITING_CAPACITY', 'DEFER', 'MORE_INFORMATION', 'REJECT');

-- CreateEnum
CREATE TYPE "DeliveryLane" AS ENUM ('RAPID_DEPLOYMENT', 'EXTERNAL_FDE_POD', 'CORE_TRANSFORMATION');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KpiValueType" AS ENUM ('ESTIMATED', 'VALIDATED');

-- CreateEnum
CREATE TYPE "KpiCategory" AS ENUM ('HOURS_SAVED', 'COST_SAVINGS', 'REVENUE_IMPACT', 'MARGIN_IMPACT', 'PRODUCTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('INITIATIVE', 'PROJECT', 'TASK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyItem" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'DRAFT',
    "requesterId" TEXT NOT NULL,
    "portfolioCompanyId" TEXT,
    "functionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeResponse" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "businessProblem" TEXT,
    "currentProcess" TEXT,
    "affected" JSONB,
    "aiTask" TEXT,
    "successDefinition" TEXT,
    "valueCreation" JSONB,
    "effortEstimate" "EffortEstimate",
    "priorAttempts" TEXT,
    "priorAttemptsDetail" TEXT,
    "timeToArtifactValue" INTEGER,
    "timeToArtifactUnit" TEXT,
    "onlyOneAnswer" TEXT,
    "onlyOneWhy" TEXT,
    "forcingEventDate" TIMESTAMP(3),
    "forcingEvent" TEXT,
    "forcingConsequence" TEXT,
    "outcomeOwnerName" TEXT,
    "outcomeOwnerTitle" TEXT,
    "finalContext" TEXT,
    "specialistWorkflow" TEXT,
    "stepProgress" JSONB,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessOwner" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeDataSource" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "dataType" TEXT,
    "owner" TEXT,
    "accessStatus" "DataAccessStatus" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeSystem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "systemId" TEXT,
    "otherLabel" TEXT,

    CONSTRAINT "InitiativeSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeKPI" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "baseline" TEXT,
    "target" TEXT,
    "noBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeKPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeFlag" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "flagType" "FlagType" NOT NULL,
    "note" TEXT,
    "addedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeTag" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "InitiativeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "fromStatus" "InitiativeStatus" NOT NULL,
    "toStatus" "InitiativeStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageReview" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "normalizedName" TEXT,
    "normalizedProblem" TEXT,
    "normalizedAsk" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringModel" (
    "id" TEXT NOT NULL,
    "modelType" "ScoringModelType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "rubrics" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentPriorityReference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "checkSizeScore" INTEGER NOT NULL,
    "remainingValueScore" INTEGER NOT NULL,
    "runwayScore" INTEGER NOT NULL,
    "calculatedPriority" DOUBLE PRECISION NOT NULL,
    "adminNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentPriorityReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeScore" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "scorerId" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compositeScore" INTEGER NOT NULL,
    "opportunityQuality" INTEGER NOT NULL,
    "bcPriority" DOUBLE PRECISION,
    "investmentPriorityReferenceId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InitiativeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreComponent" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "dimension" "ScoreDimension" NOT NULL,
    "value" INTEGER NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "ScoreComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceDecision" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "decision" "GovernanceDecisionType" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rationale" TEXT,
    "conditions" TEXT,
    "priorityNotes" TEXT,
    "reconsiderAt" TIMESTAMP(3),
    "anticipatedLane" "DeliveryLane",
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GovernanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceDecisionMaker" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GovernanceDecisionMaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "lane" "DeliveryLane" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacitySetting" (
    "id" TEXT NOT NULL,
    "lane" "DeliveryLane" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapacitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseTemplate" (
    "id" TEXT NOT NULL,
    "lane" "DeliveryLane" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PhaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lane" "DeliveryLane" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "leadId" TEXT,
    "health" "ProjectHealth" NOT NULL DEFAULT 'GREEN',
    "healthNote" TEXT,
    "currentPhaseId" TEXT,
    "targetDeploymentDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "priority" TEXT,
    "phaseId" TEXT,
    "dependencyTaskId" TEXT,
    "blockerNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "phaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "accomplished" TEXT,
    "next" TEXT,
    "risks" TEXT,
    "decisionsNeeded" TEXT,
    "kpiUpdate" TEXT,
    "healthAtTime" "ProjectHealth" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectKPI" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "initiativeKpiId" TEXT,
    "metric" TEXT NOT NULL,
    "baseline" TEXT,
    "target" TEXT,
    "currentResult" TEXT,
    "measuredAt" TIMESTAMP(3),
    "methodology" TEXT,
    "valueType" "KpiValueType" NOT NULL DEFAULT 'ESTIMATED',
    "category" "KpiCategory" NOT NULL DEFAULT 'OTHER',
    "numericValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectKPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT,
    "projectId" TEXT,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" "EntityType",
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "teamScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCompany_name_key" ON "PortfolioCompany"("name");

-- CreateIndex
CREATE INDEX "TaxonomyItem_kind_isActive_idx" ON "TaxonomyItem"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyItem_kind_label_key" ON "TaxonomyItem"("kind", "label");

-- CreateIndex
CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");

-- CreateIndex
CREATE INDEX "Initiative_requesterId_idx" ON "Initiative"("requesterId");

-- CreateIndex
CREATE INDEX "Initiative_portfolioCompanyId_idx" ON "Initiative"("portfolioCompanyId");

-- CreateIndex
CREATE INDEX "Initiative_requestType_status_idx" ON "Initiative"("requestType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeResponse_initiativeId_key" ON "IntakeResponse"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_initiativeId_key" ON "Sponsor"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessOwner_initiativeId_key" ON "BusinessOwner"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeDataSource_initiativeId_idx" ON "InitiativeDataSource"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeSystem_initiativeId_idx" ON "InitiativeSystem"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeKPI_initiativeId_idx" ON "InitiativeKPI"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeFlag_initiativeId_idx" ON "InitiativeFlag"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeFlag_initiativeId_flagType_key" ON "InitiativeFlag"("initiativeId", "flagType");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeTag_initiativeId_tagId_key" ON "InitiativeTag"("initiativeId", "tagId");

-- CreateIndex
CREATE INDEX "StatusTransition_initiativeId_createdAt_idx" ON "StatusTransition"("initiativeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriageReview_initiativeId_key" ON "TriageReview"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringModel_modelType_key" ON "ScoringModel"("modelType");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringModelVersion_modelId_version_key" ON "ScoringModelVersion"("modelId", "version");

-- CreateIndex
CREATE INDEX "InvestmentPriorityReference_companyId_effectiveDate_idx" ON "InvestmentPriorityReference"("companyId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPriorityReference_companyId_version_key" ON "InvestmentPriorityReference"("companyId", "version");

-- CreateIndex
CREATE INDEX "InitiativeScore_initiativeId_isCurrent_idx" ON "InitiativeScore"("initiativeId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreComponent_scoreId_dimension_key" ON "ScoreComponent"("scoreId", "dimension");

-- CreateIndex
CREATE INDEX "GovernanceDecision_initiativeId_isCurrent_idx" ON "GovernanceDecision"("initiativeId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDecisionMaker_decisionId_userId_key" ON "GovernanceDecisionMaker"("decisionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAssignment_initiativeId_key" ON "DeliveryAssignment"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "CapacitySetting_lane_key" ON "CapacitySetting"("lane");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseTemplate_lane_sortOrder_key" ON "PhaseTemplate"("lane", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Project_initiativeId_key" ON "Project"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_currentPhaseId_key" ON "Project"("currentPhaseId");

-- CreateIndex
CREATE INDEX "Project_lane_status_idx" ON "Project"("lane", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPhase_projectId_sortOrder_key" ON "ProjectPhase"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_ownerId_status_idx" ON "Task"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_createdAt_idx" ON "ProjectUpdate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectKPI_projectId_idx" ON "ProjectKPI"("projectId");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_createdAt_idx" ON "Comment"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_initiativeId_createdAt_idx" ON "ActivityEvent"("initiativeId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_projectId_createdAt_idx" ON "ActivityEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "SavedView_userId_tableKey_idx" ON "SavedView"("userId", "tableKey");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_portfolioCompanyId_fkey" FOREIGN KEY ("portfolioCompanyId") REFERENCES "PortfolioCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessOwner" ADD CONSTRAINT "BusinessOwner_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeDataSource" ADD CONSTRAINT "InitiativeDataSource_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeSystem" ADD CONSTRAINT "InitiativeSystem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeSystem" ADD CONSTRAINT "InitiativeSystem_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeKPI" ADD CONSTRAINT "InitiativeKPI_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeFlag" ADD CONSTRAINT "InitiativeFlag_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeFlag" ADD CONSTRAINT "InitiativeFlag_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeTag" ADD CONSTRAINT "InitiativeTag_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeTag" ADD CONSTRAINT "InitiativeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TaxonomyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageReview" ADD CONSTRAINT "TriageReview_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageReview" ADD CONSTRAINT "TriageReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringModelVersion" ADD CONSTRAINT "ScoringModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ScoringModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringModelVersion" ADD CONSTRAINT "ScoringModelVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPriorityReference" ADD CONSTRAINT "InvestmentPriorityReference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PortfolioCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPriorityReference" ADD CONSTRAINT "InvestmentPriorityReference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeScore" ADD CONSTRAINT "InitiativeScore_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeScore" ADD CONSTRAINT "InitiativeScore_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ScoringModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeScore" ADD CONSTRAINT "InitiativeScore_scorerId_fkey" FOREIGN KEY ("scorerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeScore" ADD CONSTRAINT "InitiativeScore_investmentPriorityReferenceId_fkey" FOREIGN KEY ("investmentPriorityReferenceId") REFERENCES "InvestmentPriorityReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreComponent" ADD CONSTRAINT "ScoreComponent_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "InitiativeScore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecisionMaker" ADD CONSTRAINT "GovernanceDecisionMaker_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GovernanceDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecisionMaker" ADD CONSTRAINT "GovernanceDecisionMaker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_currentPhaseId_fkey" FOREIGN KEY ("currentPhaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKPI" ADD CONSTRAINT "ProjectKPI_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKPI" ADD CONSTRAINT "ProjectKPI_initiativeKpiId_fkey" FOREIGN KEY ("initiativeKpiId") REFERENCES "InitiativeKPI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
