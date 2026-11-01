pipeline {
  agent any

  parameters {
    booleanParam(name: 'DEPLOY_TO_KUBERNETES', defaultValue: false, description: 'Build, publish, and deploy to the configured Kubernetes cluster.')
    string(name: 'CONTAINER_REGISTRY', defaultValue: 'docker.io/REPLACE_WITH_YOUR_DOCKERHUB_USERNAME', description: 'Registry/namespace that contains public workzen-backend and workzen-frontend images.')
  }

  options {
    timestamps()
    skipDefaultCheckout(true)
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
          if (isUnix()) {
            sh 'docker compose -f compose.production.yaml config --quiet'
          } else {
            bat 'docker compose -f compose.production.yaml config --quiet'
          }
        }
      }
    }

    stage('Build Kubernetes images') {
      when { expression { return params.DEPLOY_TO_KUBERNETES } }
      steps {
        script {
          if (params.CONTAINER_REGISTRY.contains('REPLACE_WITH')) {
            error('Set CONTAINER_REGISTRY to your Docker Hub username/namespace before deploying.')
          }
          env.WORKZEN_IMAGE_TAG = env.BUILD_NUMBER
          env.WORKZEN_BACKEND_IMAGE = "${params.CONTAINER_REGISTRY}/workzen-backend:${env.WORKZEN_IMAGE_TAG}"
          env.WORKZEN_FRONTEND_IMAGE = "${params.CONTAINER_REGISTRY}/workzen-frontend:${env.WORKZEN_IMAGE_TAG}"
          withCredentials([usernamePassword(credentialsId: 'workzen-container-registry', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_TOKEN')]) {
            if (isUnix()) {
              sh '''echo "$REGISTRY_TOKEN" | docker login docker.io --username "$REGISTRY_USER" --password-stdin
                docker build -t "$WORKZEN_BACKEND_IMAGE" ./backend
                docker build -t "$WORKZEN_FRONTEND_IMAGE" ./frontend
                docker push "$WORKZEN_BACKEND_IMAGE"
                docker push "$WORKZEN_FRONTEND_IMAGE"'''
            } else {
              bat '''echo %REGISTRY_TOKEN% | docker login docker.io --username %REGISTRY_USER% --password-stdin
                docker build -t %WORKZEN_BACKEND_IMAGE% .\\backend
                docker build -t %WORKZEN_FRONTEND_IMAGE% .\\frontend
                docker push %WORKZEN_BACKEND_IMAGE%
                docker push %WORKZEN_FRONTEND_IMAGE%'''
            }
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      when { expression { return params.DEPLOY_TO_KUBERNETES } }
      steps {
        withCredentials([
          file(credentialsId: 'workzen-kubeconfig', variable: 'KUBECONFIG_FILE'),
          string(credentialsId: 'workzen-django-secret', variable: 'DJANGO_SECRET'),
          string(credentialsId: 'workzen-postgres-password', variable: 'POSTGRES_PASSWORD'),
          string(credentialsId: 'workzen-grafana-password', variable: 'GRAFANA_PASSWORD')
        ]) {
          script {
            if (isUnix()) {
              sh '''kubectl --kubeconfig "$KUBECONFIG_FILE" apply -f k8s/namespace.yaml
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen create secret generic workzen-secrets --from-literal=SECRET_KEY="$DJANGO_SECRET" --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" --from-literal=DATABASE_URL="postgresql://workzen:$POSTGRES_PASSWORD@postgres:5432/workzen" --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG_FILE" apply -f -
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n monitoring create secret generic grafana-secrets --from-literal=GRAFANA_ADMIN_PASSWORD="$GRAFANA_PASSWORD" --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG_FILE" apply -f -
                kubectl --kubeconfig "$KUBECONFIG_FILE" apply -k k8s
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen set image deployment/workzen-backend migrate="$WORKZEN_BACKEND_IMAGE" backend="$WORKZEN_BACKEND_IMAGE"
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen set image deployment/workzen-worker worker="$WORKZEN_BACKEND_IMAGE"
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen set image deployment/workzen-beat beat="$WORKZEN_BACKEND_IMAGE"
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen set image deployment/workzen-frontend frontend="$WORKZEN_FRONTEND_IMAGE"
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen rollout status deployment/postgres --timeout=180s
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen rollout status deployment/workzen-backend --timeout=180s
                kubectl --kubeconfig "$KUBECONFIG_FILE" -n workzen rollout status deployment/workzen-frontend --timeout=180s'''
            } else {
              bat '''kubectl --kubeconfig "%KUBECONFIG_FILE%" apply -f k8s\\namespace.yaml
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen create secret generic workzen-secrets --from-literal=SECRET_KEY="%DJANGO_SECRET%" --from-literal=POSTGRES_PASSWORD="%POSTGRES_PASSWORD%" --from-literal=DATABASE_URL="postgresql://workzen:%POSTGRES_PASSWORD%@postgres:5432/workzen" --dry-run=client -o yaml | kubectl --kubeconfig "%KUBECONFIG_FILE%" apply -f -
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n monitoring create secret generic grafana-secrets --from-literal=GRAFANA_ADMIN_PASSWORD="%GRAFANA_PASSWORD%" --dry-run=client -o yaml | kubectl --kubeconfig "%KUBECONFIG_FILE%" apply -f -
                kubectl --kubeconfig "%KUBECONFIG_FILE%" apply -k k8s
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen set image deployment/workzen-backend migrate="%WORKZEN_BACKEND_IMAGE%" backend="%WORKZEN_BACKEND_IMAGE%"
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen set image deployment/workzen-worker worker="%WORKZEN_BACKEND_IMAGE%"
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen set image deployment/workzen-beat beat="%WORKZEN_BACKEND_IMAGE%"
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen set image deployment/workzen-frontend frontend="%WORKZEN_FRONTEND_IMAGE%"
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen rollout status deployment/postgres --timeout=180s
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen rollout status deployment/workzen-backend --timeout=180s
                kubectl --kubeconfig "%KUBECONFIG_FILE%" -n workzen rollout status deployment/workzen-frontend --timeout=180s'''
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
