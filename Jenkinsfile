// Runs the backend/frontend checks on every push, then (on main) builds, pushes and
// deploys to Kubernetes and rolls back automatically if the rollout does not become healthy.
// Setup steps: docs/jenkins-automation.md

// Runs one command on Linux or Windows agents. Write variables as $NAME; on Windows
// they are converted to %NAME%.
def run(String command) {
  if (isUnix()) {
    sh command
  } else {
    bat command.replaceAll(/\$([A-Z_]+)/, '%$1%')
  }
}

def shouldDeploy() {
  def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
  return params.DEPLOY_TO_KUBERNETES && (branch ==~ /(origin\/)?main/)
}

pipeline {
  agent any

  triggers {
    // Instant builds when a GitHub webhook can reach Jenkins; polling covers setups that cannot.
    githubPush()
    pollSCM('H/5 * * * *')
  }

  parameters {
    booleanParam(name: 'DEPLOY_TO_KUBERNETES', defaultValue: true, description: 'Build, publish, and deploy to Kubernetes when building main.')
    string(name: 'CONTAINER_REGISTRY', defaultValue: 'docker.io/REPLACE_WITH_YOUR_DOCKERHUB_USERNAME', description: 'Registry/namespace that holds the workzen-backend and workzen-frontend images. Set this default to your Docker Hub username once so push-triggered builds work.')
    string(name: 'PUBLIC_HOST', defaultValue: 'localhost', description: 'Host name users open in the browser (no scheme or port). Added to ALLOWED_HOSTS.')
    string(name: 'PUBLIC_URL', defaultValue: 'http://localhost:30080', description: 'Full public URL of the frontend. Used for CORS, CSRF and invitation links.')
    string(name: 'GEMINI_MODEL', defaultValue: 'gemini-3.5-flash', description: 'Gemini model for the AI Project Architect.')
  }

  options {
    timestamps()
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Backend checks and tests') {
      steps {
        dir('backend') {
          script {
            if (isUnix()) {
              sh '''python3 -m venv .venv-ci
                . .venv-ci/bin/activate
                pip install -r requirements.txt -r requirements-sla.txt -r requirements-onboarding.txt
                DEBUG=False SECRET_KEY=jenkins-validation-secret-9d7f3a61c8e4b2f0-rotate-before-production ALLOWED_HOSTS=ci.example.test CORS_ALLOWED_ORIGINS=https://ci.example.test CSRF_TRUSTED_ORIGINS=https://ci.example.test python manage.py check --deploy
                python manage.py makemigrations --check --dry-run
                python manage.py test accounts.tests_security companies.tests companies.tests_security companies.tests_integrity dashboard.tests_integrity hr.tests_security projects.tests tasks.tests tasks.tests_integrity workflows.tests ai_insights.tests'''
            } else {
              bat '''py -3.12 -m venv .venv-ci
                call .venv-ci\\Scripts\\activate.bat
                pip install -r requirements.txt -r requirements-sla.txt -r requirements-onboarding.txt
                set DEBUG=False&& set SECRET_KEY=jenkins-validation-secret-9d7f3a61c8e4b2f0-rotate-before-production&& set ALLOWED_HOSTS=ci.example.test&& set CORS_ALLOWED_ORIGINS=https://ci.example.test&& set CSRF_TRUSTED_ORIGINS=https://ci.example.test&& python manage.py check --deploy
                python manage.py makemigrations --check --dry-run
                python manage.py test accounts.tests_security companies.tests companies.tests_security companies.tests_integrity dashboard.tests_integrity hr.tests_security projects.tests tasks.tests tasks.tests_integrity workflows.tests ai_insights.tests'''
            }
          }
        }
      }
    }

    stage('Frontend production build') {
      steps {
        dir('frontend') {
          script {
            if (isUnix()) {
              sh 'npm ci && npm run build'
            } else {
              bat 'call npm ci && call npm run build'
            }
          }
        }
      }
    }

    stage('Docker Compose validation') {
      steps {
        script {
          if (!fileExists('backend/.env')) {
            writeFile file: 'backend/.env', text: '''DEBUG=True
SECRET_KEY=jenkins-local-compose-secret
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173
'''
          }
          run 'docker compose -f compose.production.yaml config --quiet'
        }
      }
    }

    stage('Build and push images') {
      when { expression { return shouldDeploy() } }
      steps {
        script {
          if (params.CONTAINER_REGISTRY.contains('REPLACE_WITH')) {
            error('Set the CONTAINER_REGISTRY default (or build parameter) to your Docker Hub username/namespace before deploying.')
          }
          env.WORKZEN_IMAGE_TAG = env.BUILD_NUMBER
          env.WORKZEN_BACKEND_IMAGE = "${params.CONTAINER_REGISTRY}/workzen-backend:${env.WORKZEN_IMAGE_TAG}"
          env.WORKZEN_FRONTEND_IMAGE = "${params.CONTAINER_REGISTRY}/workzen-frontend:${env.WORKZEN_IMAGE_TAG}"
          withCredentials([usernamePassword(credentialsId: 'workzen-container-registry', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_TOKEN')]) {
            if (isUnix()) {
              sh 'echo "$REGISTRY_TOKEN" | docker login docker.io --username "$REGISTRY_USER" --password-stdin'
            } else {
              bat 'echo %REGISTRY_TOKEN% | docker login docker.io --username %REGISTRY_USER% --password-stdin'
            }
            run 'docker build -t "$WORKZEN_BACKEND_IMAGE" ./backend'
            run 'docker build -t "$WORKZEN_FRONTEND_IMAGE" ./frontend'
            run 'docker push "$WORKZEN_BACKEND_IMAGE"'
            run 'docker push "$WORKZEN_FRONTEND_IMAGE"'
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      when { expression { return shouldDeploy() } }
      steps {
        withCredentials([
          file(credentialsId: 'workzen-kubeconfig', variable: 'KUBECONFIG_FILE'),
          string(credentialsId: 'workzen-django-secret', variable: 'DJANGO_SECRET'),
          string(credentialsId: 'workzen-postgres-password', variable: 'POSTGRES_PASSWORD'),
          string(credentialsId: 'workzen-grafana-password', variable: 'GRAFANA_PASSWORD'),
          string(credentialsId: 'workzen-gemini-api-key', variable: 'GEMINI_API_KEY'),
          string(credentialsId: 'workzen-google-client-id', variable: 'GOOGLE_CLIENT_ID')
        ]) {
          script {
            def kc = 'kubectl --kubeconfig "$KUBECONFIG_FILE"'
            run "${kc} apply -f k8s/namespace.yaml"
            run "${kc} -n workzen create secret generic workzen-secrets --from-literal=SECRET_KEY=\"\$DJANGO_SECRET\" --from-literal=POSTGRES_PASSWORD=\"\$POSTGRES_PASSWORD\" --from-literal=DATABASE_URL=\"postgresql://workzen:\$POSTGRES_PASSWORD@postgres:5432/workzen\" --from-literal=GEMINI_API_KEY=\"\$GEMINI_API_KEY\" --from-literal=GEMINI_MODEL=\"\$GEMINI_MODEL\" --from-literal=GOOGLE_CLIENT_ID=\"\$GOOGLE_CLIENT_ID\" --dry-run=client -o yaml | ${kc} apply -f -"
            run "${kc} -n monitoring create secret generic grafana-secrets --from-literal=GRAFANA_ADMIN_PASSWORD=\"\$GRAFANA_PASSWORD\" --dry-run=client -o yaml | ${kc} apply -f -"
            run "${kc} apply -k k8s"
            run "${kc} -n workzen create configmap workzen-public --from-literal=ALLOWED_HOSTS=\"\$PUBLIC_HOST,localhost,127.0.0.1,backend,workzen-backend,workzen-backend.workzen.svc.cluster.local\" --from-literal=FRONTEND_BASE_URL=\"\$PUBLIC_URL\" --from-literal=CORS_ALLOWED_ORIGINS=\"\$PUBLIC_URL\" --from-literal=CSRF_TRUSTED_ORIGINS=\"\$PUBLIC_URL\" --dry-run=client -o yaml | ${kc} apply -f -"
            try {
              run "${kc} -n workzen set image deployment/workzen-backend migrate=\"\$WORKZEN_BACKEND_IMAGE\" backend=\"\$WORKZEN_BACKEND_IMAGE\""
              run "${kc} -n workzen set image deployment/workzen-worker worker=\"\$WORKZEN_BACKEND_IMAGE\""
              run "${kc} -n workzen set image deployment/workzen-beat beat=\"\$WORKZEN_BACKEND_IMAGE\""
              run "${kc} -n workzen set image deployment/workzen-frontend frontend=\"\$WORKZEN_FRONTEND_IMAGE\""
              run "${kc} -n workzen rollout status deployment/postgres --timeout=180s"
              run "${kc} -n workzen rollout status deployment/workzen-backend --timeout=240s"
              run "${kc} -n workzen rollout status deployment/workzen-worker --timeout=180s"
              run "${kc} -n workzen rollout status deployment/workzen-beat --timeout=180s"
              run "${kc} -n workzen rollout status deployment/workzen-frontend --timeout=180s"
            } catch (err) {
              echo "Rollout failed; rolling back to the previous revision."
              ['workzen-backend', 'workzen-worker', 'workzen-beat', 'workzen-frontend'].each { name ->
                try { run "${kc} -n workzen rollout undo deployment/${name}" } catch (ignored) { echo "No previous revision for ${name}" }
              }
              throw err
            }
          }
        }
      }
    }
  }

  post {
    always {
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}
